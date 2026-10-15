import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

log = logging.getLogger(__name__)


def _send(event_id, payload):
    try:
        async_to_sync(get_channel_layer().group_send)(
            f"event_{event_id}", {"type": "event.message", "payload": payload}
        )
    except Exception:  # Redis indisponible : ne jamais casser la requête déjà commitée
        log.exception("Diffusion temps réel impossible")


def broadcast(event_id, payload):
    """Diffuse APRÈS le commit : jamais d'annonce d'un changement qui serait annulé."""
    transaction.on_commit(lambda: _send(event_id, payload))


def seats_changed(event_id, seats):
    broadcast(
        event_id,
        {"type": "seats_changed", "seats": [{"id": i, "status": s} for i, s in seats]},
    )
