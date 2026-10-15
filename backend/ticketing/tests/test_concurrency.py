import random
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.db import connection
from django.test import TransactionTestCase

from ticketing.exceptions import SeatUnavailable
from ticketing.models import Order, Seat
from ticketing.services.orders import reserve_seats

from .helpers import make_event, make_user


@skipUnless(connection.vendor == "postgresql", "select_for_update exige PostgreSQL (Neon)")
class ConcurrencyTests(TransactionTestCase):
    """TransactionTestCase : les transactions sont VRAIMENT commitées, donc les threads
    se voient réellement (un TestCase classique enveloppe tout dans une seule transaction)."""

    def _run(self, users, pick_seats):
        barrier = Barrier(len(users))

        def worker(user):
            try:
                barrier.wait()  # tous partent au même instant
                reserve_seats(user, self.event, pick_seats())
                return "ok"
            except SeatUnavailable:
                return "conflict"
            finally:
                connection.close()  # chaque thread a sa propre connexion

        with ThreadPoolExecutor(max_workers=len(users)) as pool:
            return list(pool.map(worker, users))

    def test_same_seat_only_one_wins(self):
        self.event = make_event(n_seats=1)
        seat = self.event.seats.get()
        users = [make_user(f"u{i}") for i in range(20)]

        results = self._run(users, lambda: [seat.id])

        self.assertEqual(results.count("ok"), 1)
        self.assertEqual(results.count("conflict"), 19)
        self.assertEqual(Order.objects.count(), 1)
        seat.refresh_from_db()
        self.assertEqual(seat.status, Seat.Status.HELD)

    def test_overlapping_multi_seat_requests_no_oversell_no_deadlock(self):
        self.event = make_event(n_seats=10)
        ids = list(self.event.seats.values_list("id", flat=True))
        users = [make_user(f"v{i}") for i in range(30)]

        results = self._run(users, lambda: random.sample(ids, 3))

        wins = results.count("ok")
        held = Seat.objects.filter(status=Seat.Status.HELD).count()
        self.assertEqual(held, wins * 3)  # chaque victoire = exactement 3 sièges, jamais partagés
        self.assertLessEqual(held, 10)
        self.assertEqual(Order.objects.count(), wins)
        self.assertEqual(wins + results.count("conflict"), 30)
