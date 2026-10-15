"""Les noms de champs sont en camelCase : c'est le contrat avec le front TypeScript."""
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Event, Order, PriceCategory, Seat
from .services import audit


class PriceCategorySerializer(serializers.ModelSerializer):
    priceCents = serializers.IntegerField(source="price_cents")

    class Meta:
        model = PriceCategory
        fields = ["id", "name", "priceCents"]


class EventSerializer(serializers.ModelSerializer):
    startsAt = serializers.DateTimeField(source="starts_at")
    categories = PriceCategorySerializer(many=True, read_only=True)
    availableSeats = serializers.IntegerField(read_only=True)
    totalSeats = serializers.IntegerField(read_only=True)

    class Meta:
        model = Event
        fields = ["id", "title", "startsAt", "venue", "categories", "availableSeats", "totalSeats"]


class SeatSerializer(serializers.ModelSerializer):
    categoryId = serializers.IntegerField(source="category_id")
    mine = serializers.SerializerMethodField()

    class Meta:
        model = Seat
        fields = ["id", "row", "number", "status", "categoryId", "mine"]

    def get_mine(self, obj):
        user = self.context["request"].user
        return bool(obj.order_id and user.is_authenticated and obj.order.user_id == user.id)


class OrderSeatSerializer(serializers.ModelSerializer):
    categoryId = serializers.IntegerField(source="category_id")
    priceCents = serializers.IntegerField(source="category.price_cents")

    class Meta:
        model = Seat
        fields = ["id", "row", "number", "categoryId", "priceCents"]


class OrderSerializer(serializers.ModelSerializer):
    eventId = serializers.IntegerField(source="event_id")
    eventTitle = serializers.CharField(source="event.title")
    totalCents = serializers.IntegerField(source="total_cents")
    expiresAt = serializers.DateTimeField(source="expires_at")
    createdAt = serializers.DateTimeField(source="created_at")
    paidAt = serializers.DateTimeField(source="paid_at")
    seats = OrderSeatSerializer(many=True)
    # Heure serveur : le front calcule le décalage d'horloge pour un compte à rebours juste.
    serverTime = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "eventId", "eventTitle", "status", "totalCents",
            "expiresAt", "createdAt", "paidAt", "seats", "serverTime",
        ]

    def get_serverTime(self, obj):
        return timezone.now().isoformat()


# ---------------------------------------------------------------- back-office
class CategoryInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50)
    priceCents = serializers.IntegerField(min_value=0)
    rows = serializers.IntegerField(min_value=1, max_value=50)


def row_label(index: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA ..."""
    label = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        label = chr(65 + rem) + label
    return label


class EventCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    venue = serializers.CharField(max_length=200)
    startsAt = serializers.DateTimeField()
    seatsPerRow = serializers.IntegerField(min_value=1, max_value=60)
    categories = CategoryInputSerializer(many=True, allow_empty=False)

    def validate_categories(self, value):
        if len(value) > 6:
            raise serializers.ValidationError("6 catégories maximum.")
        if sum(c["rows"] for c in value) > 52:
            raise serializers.ValidationError("52 rangées maximum au total.")
        return value

    @transaction.atomic
    def create(self, data):
        organizer = self.context["request"].user
        event = Event.objects.create(
            organizer=organizer, title=data["title"], venue=data["venue"], starts_at=data["startsAt"]
        )
        seats, row_index = [], 0
        for cat in data["categories"]:
            category = PriceCategory.objects.create(
                event=event, name=cat["name"], price_cents=cat["priceCents"]
            )
            for _ in range(cat["rows"]):
                label = row_label(row_index)
                row_index += 1
                seats += [
                    Seat(event=event, category=category, row=label, number=n)
                    for n in range(1, data["seatsPerRow"] + 1)
                ]
        Seat.objects.bulk_create(seats)  # ordre d'insertion = ordre d'id = ordre du plan
        audit.log(organizer, "event.created", event, seats=len(seats))
        return event
