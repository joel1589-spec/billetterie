import hashlib
import hmac
import json
import logging
import random
import uuid

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Event, Order
from .services import orders, waitlist

log = logging.getLogger(__name__)


@shared_task
def expire_order_task(order_id):
    """Programmée à created+10 min (ETA). Idempotente."""
    return orders.expire_order(order_id)


@shared_task
def sweep_expired_orders():
    """Filet de sécurité (Celery beat) : rattrape les ETA perdus (redémarrage de Redis...)."""
    ids = Order.objects.filter(
        status=Order.Status.PENDING, expires_at__lte=timezone.now()
    ).values_list("id", flat=True)
    return sum(1 for i in list(ids) if orders.expire_order(i))


@shared_task
def process_waitlist_task(event_id):
    waitlist.process(event_id)


@shared_task
def process_all_waitlists():
    for event_id in Event.objects.values_list("id", flat=True):
        waitlist.process(event_id)


def _post_webhook(body: dict):
    raw = json.dumps(body).encode()
    signature = hmac.new(settings.WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    requests.post(
        settings.WEBHOOK_URL,
        data=raw,
        headers={"Content-Type": "application/json", "X-Signature": signature},
        timeout=10,
    )


@shared_task
def simulate_payment(order_id):
    """Faux prestataire : appelle le webhook (le délai de 1-15 s vient du countdown
    posé à l'appel). 25 % du temps il envoie le même webhook deux fois."""
    body = {"event_id": f"evt_{uuid.uuid4().hex}", "order_id": order_id, "status": "succeeded"}
    _post_webhook(body)
    if random.random() < 0.25:
        log.info("Prestataire simulé : webhook en double pour la commande %s", order_id)
        _post_webhook(body)
