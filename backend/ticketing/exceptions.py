class TicketingError(Exception):
    """Base des erreurs métier."""


class InvalidTransition(TicketingError):
    def __init__(self, current: str, target: str):
        super().__init__(f"Transition interdite : {current} -> {target}")
        self.current, self.target = current, target


class InvalidSeatSelection(TicketingError):
    """Sélection vide, trop grande ou contenant des sièges inconnus."""


class SeatUnavailable(TicketingError):
    def __init__(self, seat_ids):
        super().__init__("Un ou plusieurs sièges ne sont plus disponibles.")
        self.seat_ids = list(seat_ids)


class SeatLimitExceeded(TicketingError):
    pass


class PriorityWindowActive(TicketingError):
    def __init__(self, until):
        super().__init__("Une fenêtre prioritaire de liste d'attente est en cours.")
        self.until = until


class EventNotSoldOut(TicketingError):
    pass
