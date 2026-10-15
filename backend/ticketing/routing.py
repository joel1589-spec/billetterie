from django.urls import path

from .consumers import EventConsumer

websocket_urlpatterns = [path("ws/events/<int:event_id>/", EventConsumer.as_asgi())]
