from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "customer", "Client"
        ORGANIZER = "organizer", "Organisateur"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)

    @property
    def is_organizer_or_admin(self) -> bool:
        return self.role in (self.Role.ORGANIZER, self.Role.ADMIN)
