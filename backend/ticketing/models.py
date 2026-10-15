from django.conf import settings
from django.db import models
from django.db.models import Q

from .exceptions import InvalidTransition


class Event(models.Model):
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="events"
    )
    title = models.CharField(max_length=200)
    venue = models.CharField(max_length=200)
    starts_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at"]

    def __str__(self):
        return self.title


class PriceCategory(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=50)
    price_cents = models.PositiveIntegerField()  # jamais de float pour de l'argent

    def __str__(self):
        return f"{self.name} ({self.price_cents / 100:.2f})"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        PAID = "paid"
        EXPIRED = "expired"
        CANCELLED = "cancelled"
        REFUNDED = "refunded"

    # Machine à états : tout ce qui n'est pas listé est interdit.
    # expired -> refunded : paiement reçu après expiration (remboursement automatique).
    TRANSITIONS = {
        Status.PENDING: {Status.PAID, Status.EXPIRED, Status.CANCELLED},
        Status.PAID: {Status.REFUNDED},
        Status.EXPIRED: {Status.REFUNDED},
        Status.CANCELLED: {Status.REFUNDED},
        Status.REFUNDED: set(),
    }

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    event = models.ForeignKey(Event, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    total_cents = models.PositiveIntegerField()
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "expires_at"])]

    def transition_to(self, new_status: str) -> None:
        """Change le statut en mémoire (l'appelant sauvegarde, sous verrou)."""
        allowed = self.TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise InvalidTransition(self.status, new_status)
        self.status = new_status


class Seat(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available"
        HELD = "held"
        SOLD = "sold"

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="seats")
    category = models.ForeignKey(PriceCategory, on_delete=models.PROTECT, related_name="seats")
    row = models.CharField(max_length=4)
    number = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.AVAILABLE)
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name="seats")

    class Meta:
        ordering = ["id"]
        constraints = [
            # Un siège physique n'existe qu'une fois par événement.
            models.UniqueConstraint(fields=["event", "row", "number"], name="uniq_seat_position"),
            # Invariant en base : un siège libre n'a pas de commande, un siège pris en a une.
            models.CheckConstraint(
                condition=Q(status="available", order__isnull=True)
                | (~Q(status="available") & Q(order__isnull=False)),
                name="seat_status_matches_order",
            ),
        ]
        indexes = [models.Index(fields=["event", "status"])]

    def __str__(self):
        return f"{self.row}{self.number}"


class WebhookEvent(models.Model):
    """Journal des webhooks reçus. L'unicité de provider_event_id = idempotence."""

    provider_event_id = models.CharField(max_length=100, unique=True)
    order = models.ForeignKey(Order, null=True, on_delete=models.SET_NULL, related_name="webhooks")
    payload = models.JSONField()
    outcome = models.CharField(max_length=50, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)


class WaitlistEntry(models.Model):
    class Status(models.TextChoices):
        WAITING = "waiting"
        NOTIFIED = "notified"
        FULFILLED = "fulfilled"
        EXPIRED = "expired"

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="waitlist")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.WAITING)
    created_at = models.DateTimeField(auto_now_add=True)
    notified_at = models.DateTimeField(null=True, blank=True)
    priority_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # Une seule inscription "active" par utilisateur et par événement.
            models.UniqueConstraint(
                fields=["event", "user"],
                condition=Q(status__in=["waiting", "notified"]),
                name="uniq_active_waitlist_entry",
            )
        ]


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=60)
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.BigIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
