from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from ticketing.models import Order, Seat, WebhookEvent
from ticketing.services.orders import expire_order, handle_payment_webhook, reserve_seats

from .helpers import make_event, make_user


class WebhookTests(TestCase):
    def setUp(self):
        self.user = make_user("client")
        self.event = make_event(n_seats=2)
        self.seat_ids = list(self.event.seats.values_list("id", flat=True))
        self.order = reserve_seats(self.user, self.event, self.seat_ids[:1])

    def test_webhook_is_idempotent(self):
        first = handle_payment_webhook("evt_1", self.order.id, "succeeded")
        second = handle_payment_webhook("evt_1", self.order.id, "succeeded")  # doublon exact

        self.assertEqual(first, "paid")
        self.assertEqual(second, "duplicate")
        self.assertEqual(WebhookEvent.objects.filter(provider_event_id="evt_1").count(), 1)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PAID)
        self.assertEqual(Seat.objects.get(id=self.seat_ids[0]).status, Seat.Status.SOLD)

    def test_second_event_for_same_order_changes_nothing(self):
        handle_payment_webhook("evt_a", self.order.id, "succeeded")
        outcome = handle_payment_webhook("evt_b", self.order.id, "succeeded")
        self.assertEqual(outcome, "already_processed")
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PAID)

    def test_webhook_after_expiration_is_refunded_not_paid(self):
        Order.objects.filter(pk=self.order.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertTrue(expire_order(self.order.id))
        self.assertEqual(Seat.objects.get(id=self.seat_ids[0]).status, Seat.Status.AVAILABLE)

        outcome = handle_payment_webhook("evt_late", self.order.id, "succeeded")

        self.assertEqual(outcome, "late_payment_refunded")
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.REFUNDED)
        # le siège reste libre : pas de vente sans commande valide
        self.assertEqual(Seat.objects.get(id=self.seat_ids[0]).status, Seat.Status.AVAILABLE)

    def test_expire_is_idempotent_and_ignores_fresh_orders(self):
        self.assertFalse(expire_order(self.order.id))  # pas encore échue
        Order.objects.filter(pk=self.order.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertTrue(expire_order(self.order.id))
        self.assertFalse(expire_order(self.order.id))  # 2e appel : rien
