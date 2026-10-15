from rest_framework.test import APIClient
from django.test import TestCase

from .helpers import make_event, make_user


class ReserveApiTests(TestCase):
    def test_second_user_gets_409_with_conflicting_seat_ids(self):
        event = make_event(n_seats=1)
        seat_id = event.seats.get().id
        a, b = APIClient(), APIClient()
        a.force_authenticate(make_user("a"))
        b.force_authenticate(make_user("b"))

        r1 = a.post(f"/api/events/{event.id}/reserve/", {"seatIds": [seat_id]}, format="json")
        r2 = b.post(f"/api/events/{event.id}/reserve/", {"seatIds": [seat_id]}, format="json")

        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 409)
        self.assertEqual(r2.json()["code"], "seat_unavailable")
        self.assertEqual(r2.json()["seatIds"], [seat_id])

    def test_more_than_six_seats_refused(self):
        event = make_event(n_seats=8)
        c = APIClient()
        c.force_authenticate(make_user("c"))
        ids = list(event.seats.values_list("id", flat=True))
        r = c.post(f"/api/events/{event.id}/reserve/", {"seatIds": ids[:7]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_anonymous_cannot_reserve(self):
        event = make_event(n_seats=1)
        r = APIClient().post(f"/api/events/{event.id}/reserve/", {"seatIds": [1]}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_organizer_only_sees_own_events_in_dashboard(self):
        orga1, orga2 = make_user("o1", "organizer"), make_user("o2", "organizer")
        make_event(2, organizer=orga1)
        make_event(2, organizer=orga2)
        c = APIClient()
        c.force_authenticate(orga1)
        rows = c.get("/api/backoffice/dashboard/").json()
        self.assertEqual(len(rows), 1)
        customer = APIClient()
        customer.force_authenticate(make_user("cust"))
        self.assertEqual(customer.get("/api/backoffice/dashboard/").status_code, 403)
