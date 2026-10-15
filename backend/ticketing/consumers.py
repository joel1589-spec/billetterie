from channels.generic.websocket import AsyncJsonWebsocketConsumer


class EventConsumer(AsyncJsonWebsocketConsumer):
    """Diffuse les changements d'un événement. Le client ne fait que recevoir :
    toutes les actions passent par l'API REST (le serveur reste seule source de vérité)."""

    async def connect(self):
        self.group = f"event_{self.scope['url_route']['kwargs']['event_id']}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def event_message(self, message):  # type "event.message"
        await self.send_json(message["payload"])
