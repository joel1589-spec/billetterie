from django.test import SimpleTestCase

from ticketing.exceptions import InvalidTransition
from ticketing.models import Order

S = Order.Status


class OrderStateMachineTests(SimpleTestCase):
    def test_valid_transitions(self):
        for src, dst in [(S.PENDING, S.PAID), (S.PENDING, S.EXPIRED), (S.PENDING, S.CANCELLED),
                         (S.PAID, S.REFUNDED), (S.EXPIRED, S.REFUNDED)]:
            order = Order(status=src)
            order.transition_to(dst)
            self.assertEqual(order.status, dst)

    def test_invalid_transitions_are_refused(self):
        for src, dst in [(S.PAID, S.PENDING), (S.PAID, S.EXPIRED), (S.EXPIRED, S.PAID),
                         (S.CANCELLED, S.PAID), (S.REFUNDED, S.PAID), (S.REFUNDED, S.PENDING)]:
            order = Order(status=src)
            with self.assertRaises(InvalidTransition):
                order.transition_to(dst)
            self.assertEqual(order.status, src)  # inchangé
