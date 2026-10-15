from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from ..exceptions import EventNotSoldOut
from ..models import Seat, WaitlistEntry
from . import audit
from .realtime import broadcast

PRIORITY_WINDOW = timedelta(minutes=5)


def join(user, event) -> WaitlistEntry:
    if Seat.objects.filter(event=event, status=Seat.Status.AVAILABLE).exists():
        raise EventNotSoldOut("Des places sont encore disponibles.")
    try:
        with transaction.atomic():
            entry = WaitlistEntry.objects.create(event=event, user=user)
            audit.log(user, "waitlist.joined", event)
    except IntegrityError:
        entry = WaitlistEntry.objects.get(
            event=event, user=user, status__in=["waiting", "notified"]
        )
    return entry


def leave(user, event) -> None:
    WaitlistEntry.objects.filter(
        event=event, user=user, status__in=["waiting", "notified"]
    ).update(status=WaitlistEntry.Status.EXPIRED)


def position(entry: WaitlistEntry) -> int:
    return (
        WaitlistEntry.objects.filter(
            event=entry.event, status=WaitlistEntry.Status.WAITING, created_at__lt=entry.created_at
        ).count()
        + 1
    )


def process(event_id) -> None:
    """Ferme les fenêtres échues, puis notifie le suivant si des places sont libres."""
    from .. import tasks
    from .scheduling import run_later

    with transaction.atomic():
        now = timezone.now()
        WaitlistEntry.objects.filter(
            event_id=event_id,
            status=WaitlistEntry.Status.NOTIFIED,
            priority_expires_at__lte=now,
        ).update(status=WaitlistEntry.Status.EXPIRED)

        if WaitlistEntry.objects.filter(event_id=event_id, status=WaitlistEntry.Status.NOTIFIED).exists():
            return  # une fenêtre prioritaire est déjà ouverte
        if not Seat.objects.filter(event_id=event_id, status=Seat.Status.AVAILABLE).exists():
            return

        entry = (
            WaitlistEntry.objects.select_for_update(skip_locked=True)
            .filter(event_id=event_id, status=WaitlistEntry.Status.WAITING)
            .order_by("created_at")
            .first()
        )
        if entry is None:
            return
        entry.status = WaitlistEntry.Status.NOTIFIED
        entry.notified_at = now
        entry.priority_expires_at = now + PRIORITY_WINDOW
        entry.save(update_fields=["status", "notified_at", "priority_expires_at"])
        audit.log(None, "waitlist.notified", entry, user_id=entry.user_id)
        broadcast(
            event_id,
            {
                "type": "waitlist_notified",
                "userId": entry.user_id,
                "priorityUntil": entry.priority_expires_at.isoformat(),
            },
        )
        # À la fin de la fenêtre : passer au suivant.
        run_later(tasks.process_waitlist_task, event_id, eta=entry.priority_expires_at + timedelta(seconds=1))
