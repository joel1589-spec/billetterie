from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from ticketing.models import Event
from ticketing.serializers import EventCreateSerializer


class _Req:
    def __init__(self, user):
        self.user = user


class Command(BaseCommand):
    help = "Crée des comptes et des événements de démonstration."

    def handle(self, *args, **options):
        admin, _ = User.objects.get_or_create(username="admin", defaults={"role": "admin", "is_staff": True, "is_superuser": True})
        orga, _ = User.objects.get_or_create(username="orga", defaults={"role": "organizer"})
        alice, _ = User.objects.get_or_create(username="alice")
        for u, pwd in ((admin, "admin12345"), (orga, "orga12345"), (alice, "alice12345")):
            u.set_password(pwd)
            u.save()

        if not Event.objects.exists():
            for title, venue, days, rows, per_row, cats in (
                ("Les Misérables", "Palais des Congrès, Lomé", 50, 0, 12,
                 [{"name": "Or", "priceCents": 4500, "rows": 3}, {"name": "Argent", "priceCents": 3000, "rows": 5}]),
                ("Concert de jazz (50 sièges, test de charge)", "Institut Français", 57, 0, 10,
                 [{"name": "Unique", "priceCents": 2000, "rows": 5}]),
            ):
                s = EventCreateSerializer(
                    data={"title": title, "venue": venue, "startsAt": (timezone.now() + timedelta(days=days)).isoformat(),
                          "seatsPerRow": per_row, "categories": cats},
                    context={"request": _Req(orga)},
                )
                s.is_valid(raise_exception=True)
                s.save()
        self.stdout.write(self.style.SUCCESS(
            "OK. Comptes : admin/admin12345, orga/orga12345, alice/alice12345"))
