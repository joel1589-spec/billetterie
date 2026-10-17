from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("orders", views.OrderViewSet, basename="order")

urlpatterns = [
    path("events/", views.EventListView.as_view()),
    path("events/<int:pk>/", views.EventDetailView.as_view()),
    path("events/<int:pk>/seats/", views.SeatListView.as_view()),
    path("events/<int:pk>/reserve/", views.ReserveView.as_view()),
    path("events/<int:pk>/waitlist/", views.WaitlistView.as_view()),
    path("payments/webhook/", views.PaymentWebhookView.as_view()),
    path("backoffice/events/", views.BackofficeEventView.as_view()),
    path("backoffice/dashboard/", views.DashboardView.as_view()),
    path("backoffice/audit/", views.AuditLogView.as_view()),
    path("", include(router.urls)),
]
