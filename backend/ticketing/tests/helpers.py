from datetime import timedelta

from django.utils import timezone

from accounts.models import User
from ticketing.models import Event, PriceCategory, Seat


def make_user(name, role="customer"):
    return User.objects.create_user(username=name, password="pass-12345", role=role)


def make_event(n_seats=1, organizer=None):
    organizer = organizer or make_user("orga-" + str(User.objects.count()), "organizer")
    event = Event.objects.create(
        organizer=organizer, title="Test", venue="Salle", starts_at=timezone.now() + timedelta(days=30)
    )
    cat = PriceCategory.objects.create(event=event, name="Unique", price_cents=1000)
    Seat.objects.bulk_create(
        [Seat(event=event, category=cat, row="A", number=i + 1) for i in range(n_seats)]
    )
    return event
