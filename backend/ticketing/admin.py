from django.contrib import admin

from . import models

admin.site.register(models.Event)
admin.site.register(models.Order)
admin.site.register(models.WaitlistEntry)
admin.site.register(models.WebhookEvent)


@admin.register(models.AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "target_type", "target_id")
    readonly_fields = [f.name for f in models.AuditLog._meta.fields]
