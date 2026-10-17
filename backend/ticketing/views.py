import hashlib
import hmac
import json

from django.conf import settings
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.permissions import IsOrganizerOrAdmin

from . import serializers as sz
from .exceptions import (
    EventNotSoldOut,
    InvalidSeatSelection,
    InvalidTransition,
    PriorityWindowActive,
    SeatLimitExceeded,
    SeatUnavailable,
)
from .models import AuditLog, Event, Order, Seat, WaitlistEntry
from .services import audit, orders, waitlist


def events_with_counts():
    return Event.objects.prefetch_related("categories").annotate(
        availableSeats=Count("seats", filter=Q(seats__status="available")),
        totalSeats=Count("seats"),
    )


def error(code, detail, http_status, **extra):
    return Response({"code": code, "detail": detail, **extra}, status=http_status)


# ----------------------------------------------------------------- public
class EventListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = sz.EventSerializer
    queryset = events_with_counts()


class EventDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = sz.EventSerializer
    queryset = events_with_counts()


class SeatListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = sz.SeatSerializer
    pagination_class = None

    def get_queryset(self):
        return Seat.objects.filter(event_id=self.kwargs["pk"]).select_related("order").order_by("id")


# ----------------------------------------------------------------- réservation
class ReserveView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "reservation"

    def post(self, request, pk):
        event = get_object_or_404(Event, pk=pk)
        seat_ids = request.data.get("seatIds")
        if not isinstance(seat_ids, list) or not all(isinstance(i, int) for i in seat_ids):
            return error("invalid_payload", "seatIds doit être une liste d'entiers.", 400)
        try:
            order = orders.reserve_seats(request.user, event, seat_ids)
        except SeatUnavailable as e:
            return error("seat_unavailable", str(e), status.HTTP_409_CONFLICT, seatIds=e.seat_ids)
        except (InvalidSeatSelection, SeatLimitExceeded) as e:
            return error("invalid_selection", str(e), 400)
        except PriorityWindowActive as e:
            return error("waitlist_priority", str(e), 403, until=e.until.isoformat())
        return Response(sz.OrderSerializer(order).data, status=201)


class OrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = sz.OrderSerializer
    pagination_class = None

    def get_queryset(self):
        qs = (
            Order.objects.filter(user=self.request.user)
            .select_related("event")
            .prefetch_related("seats__category")
            .order_by("-created_at")
        )
        if event := self.request.query_params.get("event"):
            qs = qs.filter(event_id=event)
        if st := self.request.query_params.get("status"):
            qs = qs.filter(status=st)
        return qs

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        try:
            orders.start_payment(int(pk), request.user)
        except Order.DoesNotExist:
            return error("not_found", "Commande introuvable.", 404)
        except InvalidTransition as e:
            return error("invalid_transition", str(e), 409)
        return Response({"detail": "Paiement en cours de traitement."}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            order = orders.cancel_order(int(pk), request.user)
        except Order.DoesNotExist:
            return error("not_found", "Commande introuvable.", 404)
        except InvalidTransition as e:
            return error("invalid_transition", str(e), 409)
        return Response(sz.OrderSerializer(order).data)


class PaymentWebhookView(APIView):
    """Appelé par le prestataire de paiement (simulé). Authentifié par signature HMAC."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw = request.body
        expected = hmac.new(settings.WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(request.headers.get("X-Signature", ""), expected):
            return error("bad_signature", "Signature invalide.", 401)
        try:
            data = json.loads(raw)
            event_id, order_id, st = str(data["event_id"]), int(data["order_id"]), str(data["status"])
        except (ValueError, KeyError, TypeError):
            return error("invalid_payload", "Payload invalide.", 400)
        try:
            outcome = orders.handle_payment_webhook(event_id, order_id, st)
        except Order.DoesNotExist:
            return error("not_found", "Commande inconnue.", 404)
        return Response({"outcome": outcome})  # 200 même pour un doublon : le prestataire ne réessaie pas


# ----------------------------------------------------------------- liste d'attente
class WaitlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _status(self, user, event):
        entry = WaitlistEntry.objects.filter(
            event=event, user=user, status__in=["waiting", "notified"]
        ).first()
        if not entry:
            return {"status": "none"}
        return {
            "status": entry.status,
            "position": waitlist.position(entry) if entry.status == "waiting" else None,
            "priorityUntil": entry.priority_expires_at,
        }

    def get(self, request, pk):
        return Response(self._status(request.user, get_object_or_404(Event, pk=pk)))

    def post(self, request, pk):
        event = get_object_or_404(Event, pk=pk)
        try:
            waitlist.join(request.user, event)
        except EventNotSoldOut as e:
            return error("not_sold_out", str(e), 400)
        return Response(self._status(request.user, event), status=201)

    def delete(self, request, pk):
        event = get_object_or_404(Event, pk=pk)
        waitlist.leave(request.user, event)
        return Response(status=204)


# ----------------------------------------------------------------- back-office
def visible_events(user):
    """Un organisateur ne voit QUE ses événements ; l'admin voit tout."""
    qs = events_with_counts()
    return qs if user.role == "admin" else qs.filter(organizer=user)


class BackofficeEventView(generics.ListCreateAPIView):
    permission_classes = [IsOrganizerOrAdmin]
    pagination_class = None

    def get_serializer_class(self):
        return sz.EventCreateSerializer if self.request.method == "POST" else sz.EventSerializer

    def get_queryset(self):
        return visible_events(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        event = events_with_counts().get(pk=event.pk)
        return Response(sz.EventSerializer(event).data, status=201)


class DashboardView(APIView):
    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request):
        events = list(visible_events(request.user))
        ids = [e.id for e in events]
        seat_rows = (
            Seat.objects.filter(event_id__in=ids)
            .values("event_id", "status")
            .annotate(n=Count("id"))
        )
        order_rows = (
            Order.objects.filter(event_id__in=ids)
            .values("event_id", "status")
            .annotate(n=Count("id"), revenue=Sum("total_cents"))
        )
        seats, ords = {}, {}
        for r in seat_rows:
            seats.setdefault(r["event_id"], {})[r["status"]] = r["n"]
        for r in order_rows:
            ords.setdefault(r["event_id"], {})[r["status"]] = r

        out = []
        for e in events:
            s, o = seats.get(e.id, {}), ords.get(e.id, {})
            total = e.totalSeats or 0
            sold = s.get("sold", 0)
            out.append(
                {
                    "eventId": e.id,
                    "title": e.title,
                    "totalSeats": total,
                    "soldSeats": sold,
                    "heldSeats": s.get("held", 0),
                    "fillRate": round(sold / total, 4) if total else 0,
                    "revenueCents": (o.get("paid", {}).get("revenue") or 0),
                    "expiredOrders": o.get("expired", {}).get("n", 0),
                    "pendingOrders": o.get("pending", {}).get("n", 0),
                    "refundedOrders": o.get("refunded", {}).get("n", 0),
                }
            )
        return Response(out)


class AuditLogView(APIView):
    """Journal d'audit. Admin : tout. Organisateur : ses actions et celles touchant ses événements/commandes."""

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request):
        qs = AuditLog.objects.select_related("actor")
        if request.user.role != "admin":
            own_events = list(Event.objects.filter(organizer=request.user).values_list("id", flat=True))
            own_orders = list(Order.objects.filter(event_id__in=own_events).values_list("id", flat=True))
            qs = qs.filter(
                Q(actor=request.user)
                | Q(target_type="Event", target_id__in=own_events)
                | Q(target_type="Order", target_id__in=own_orders)
            )
        return Response(
            [
                {
                    "id": a.id,
                    "createdAt": a.created_at,
                    "actor": a.actor.username if a.actor else "système",
                    "action": a.action,
                    "targetType": a.target_type,
                    "targetId": a.target_id,
                    "metadata": a.metadata,
                }
                for a in qs[:200]
            ]
        )
