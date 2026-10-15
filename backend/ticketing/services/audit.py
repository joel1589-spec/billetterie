from ..models import AuditLog


def log(actor, action, target=None, **metadata):
    """Écrit dans le journal d'audit, dans la transaction courante."""
    AuditLog.objects.create(
        actor=actor if getattr(actor, "pk", None) else None,
        action=action,
        target_type=target.__class__.__name__ if target is not None else "",
        target_id=target.pk if target is not None else None,
        metadata=metadata,
    )
