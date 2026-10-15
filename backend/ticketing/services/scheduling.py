import logging

from django.db import transaction

log = logging.getLogger(__name__)


def run_later(task, *args, eta=None, countdown=None):
    """Programme une tâche Celery après commit, sans jamais faire échouer la requête."""

    def _go():
        try:
            task.apply_async(args=args, eta=eta, countdown=countdown)
        except Exception:
            log.exception("Impossible de programmer %s", task)

    transaction.on_commit(_go)
