"""Cœur métier : réservation, expiration, annulation, paiement.

Règle d'or de la concurrence : on VERROUILLE les lignes (select_for_update), puis on
VÉRIFIE, puis on MODIFIE, le tout dans une seule transaction. Les verrous sont toujours
pris dans le même ordre (commande, puis sièges triés par id) pour exclure les deadlocks.
"""
import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from ..exceptions import (
    InvalidSeatSelection,
    InvalidTransition,
    PriorityWindowActive,
    SeatLimitExceeded,
    SeatUnavailable,
)
from ..models import Order, Seat, WaitlistEntry, WebhookEvent
from . import audit
from .realtime import seats_changed
from .scheduling import run_later

log = logging.getLogger(__name__)

HOLD_DURATION = timedelta(minutes=10)
MAX_SEATS = 6


# --------------------------------------------------------------------------- réserver
def _expire_stale_holds(seat_ids):
    """Expiration paresseuse : si une réservation périmée bloque encore un siège
    (la tâche Celery n'est pas passée), on la libère avant de réserver."""
    stale = (
        Order.objects.filter(
            status=Order.Status.PENDING, expires_at__lte=timezone.now(), seats__id__in=seat_ids
        )
        .values_list("id", flat=True)
        .distinct()
    )
    for order_id in list(stale):
        expire_order(order_id)


def _check_waitlist_priority(event, user):
    active = WaitlistEntry.objects.filter(
        event=event, status=WaitlistEntry.Status.NOTIFIED, priority_expires_at__gt=timezone.now()
    )
    if active.exists() and not active.filter(user=user).exists():
        raise PriorityWindowActive(until=min(e.priority_expires_at for e in active))


def reserve_seats(user, event, seat_ids) -> Order:
    seat_ids = sorted(set(seat_ids))
    if not seat_ids or len(seat_ids) > MAX_SEATS:
        raise InvalidSeatSelection(f"Sélectionnez entre 1 et {MAX_SEATS} sièges.")

    _expire_stale_holds(seat_ids)

    with transaction.atomic():
        _check_waitlist_priority(event, user)

        already = Seat.objects.filter(
            event=event, order__user=user, order__status=Order.Status.PENDING
        ).count()
        if already + len(seat_ids) > MAX_SEATS:
            raise SeatLimitExceeded(f"Maximum {MAX_SEATS} sièges bloqués par personne.")

        # LE verrou : les autres transactions visant ces sièges attendent ici.
        seats = list(
            Seat.objects.select_for_update(of=("self",))
            .select_related("category")
            .filter(event=event, id__in=seat_ids)
            .order_by("id")
        )
        if len(seats) != len(seat_ids):
            raise InvalidSeatSelection("Siège inconnu pour cet événement.")

        taken = [s.id for s in seats if s.status != Seat.Status.AVAILABLE]
        if taken:
            raise SeatUnavailable(taken)

        order = Order.objects.create(
            user=user,
            event=event,
            total_cents=sum(s.category.price_cents for s in seats),
            expires_at=timezone.now() + HOLD_DURATION,
        )
        Seat.objects.filter(id__in=seat_ids).update(status=Seat.Status.HELD, order=order)

        WaitlistEntry.objects.filter(
            event=event, user=user, status=WaitlistEntry.Status.NOTIFIED
        ).update(status=WaitlistEntry.Status.FULFILLED)

        audit.log(user, "order.created", order, seat_ids=seat_ids, total_cents=order.total_cents)
        seats_changed(event.id, [(i, "held") for i in seat_ids])

        from .. import tasks

        run_later(tasks.expire_order_task, order.id, eta=order.expires_at)
    return order


# --------------------------------------------------------------------------- libérer
def _release_seats(order):
    """À appeler avec le verrou de la commande déjà pris."""
    seats = list(
        Seat.objects.select_for_update()
        .filter(order=order, status=Seat.Status.HELD)
        .order_by("id")
    )
    ids = [s.id for s in seats]
    Seat.objects.filter(id__in=ids).update(status=Seat.Status.AVAILABLE, order=None)
    seats_changed(order.event_id, [(i, "available") for i in ids])
    from .. import tasks

    run_later(tasks.process_waitlist_task, order.event_id)
    return ids


def expire_order(order_id) -> bool:
    """Idempotent : peut être appelé N fois (ETA + balayage + expiration paresseuse)."""
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        if order.status != Order.Status.PENDING or order.expires_at > timezone.now():
            return False
        order.transition_to(Order.Status.EXPIRED)
        order.save(update_fields=["status"])
        ids = _release_seats(order)
        audit.log(None, "order.expired", order, seat_ids=ids)
    return True


def cancel_order(order_id, user) -> Order:
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id, user=user)
        order.transition_to(Order.Status.CANCELLED)  # lève InvalidTransition si pas pending
        order.save(update_fields=["status"])
        ids = _release_seats(order)
        audit.log(user, "order.cancelled", order, seat_ids=ids)
    return order


# --------------------------------------------------------------------------- payer
def start_payment(order_id, user) -> None:
    order = Order.objects.get(pk=order_id, user=user)
    if order.status != Order.Status.PENDING:
        raise InvalidTransition(order.status, Order.Status.PAID)
    audit.log(user, "payment.started", order)
    from .. import tasks
    import random

    # Le "prestataire" répondra par webhook, 1 à 15 s plus tard.
    tasks.simulate_payment.apply_async(args=(order.id,), countdown=random.randint(1, 15))


def handle_payment_webhook(provider_event_id: str, order_id: int, status: str) -> str:
    """Traitement IDEMPOTENT d'un webhook. Retourne un code de résultat.

    1. On verrouille la commande (deux webhooks simultanés passent l'un après l'autre).
    2. On insère le webhook : la contrainte UNIQUE sur provider_event_id rejette les
       doublons. Puis on applique la machine à états.
    Si quelque chose échoue, la transaction entière est annulée, y compris l'insertion
    du webhook : le prestataire pourra réessayer.
    """
    with transaction.atomic():
        # Verrou de la commande d'abord : sérialise aussi deux webhooks simultanés.
        order = Order.objects.select_for_update().get(pk=order_id)
        try:
            with transaction.atomic():  # savepoint : l'IntegrityError n'abîme pas la transaction
                webhook = WebhookEvent.objects.create(
                    provider_event_id=provider_event_id,
                    order=order,
                    payload={"order_id": order_id, "status": status},
                )
        except IntegrityError:
            return "duplicate"

        if status != "succeeded":
            outcome = "payment_failed_ignored"
        elif order.status == Order.Status.PENDING:
            # Pending sous verrou => les sièges sont encore à nous, même si l'horloge
            # a dépassé expires_at de quelques secondes (le balayage n'est pas passé).
            order.transition_to(Order.Status.PAID)
            order.paid_at = timezone.now()
            order.save(update_fields=["status", "paid_at"])
            ids = list(
                Seat.objects.select_for_update().filter(order=order).order_by("id").values_list("id", flat=True)
            )
            Seat.objects.filter(id__in=ids).update(status=Seat.Status.SOLD)
            seats_changed(order.event_id, [(i, "sold") for i in ids])
            outcome = "paid"
        elif order.status in (Order.Status.EXPIRED, Order.Status.CANCELLED):
            # Argent reçu mais sièges déjà libérés (peut-être revendus) : on rembourse.
            order.transition_to(Order.Status.REFUNDED)
            order.save(update_fields=["status"])
            outcome = "late_payment_refunded"
        else:  # déjà paid ou refunded : autre identifiant d'événement, même effet => rien à faire
            outcome = "already_processed"

        webhook.outcome = outcome
        webhook.save(update_fields=["outcome"])
        audit.log(None, f"webhook.{outcome}", order, provider_event_id=provider_event_id)
    return outcome
