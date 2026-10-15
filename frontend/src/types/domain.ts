// Contrat avec l'API Django (noms en camelCase côté serveur aussi).
export type SeatStatus = "available" | "held" | "sold";
export type OrderStatus = "pending" | "paid" | "expired" | "cancelled" | "refunded";
export type Role = "customer" | "organizer" | "admin";

export interface PriceCategory {
  id: number;
  name: string;
  priceCents: number; // centimes : jamais de float pour de l'argent
}

export interface Event {
  id: number;
  title: string;
  startsAt: string; // ISO 8601
  venue: string;
  categories: PriceCategory[];
  availableSeats: number;
  totalSeats: number;
}

export interface Seat {
  id: number;
  row: string;
  number: number;
  status: SeatStatus;
  categoryId: number;
  mine: boolean; // réservé par l'utilisateur connecté
}

export interface OrderSeat {
  id: number;
  row: string;
  number: number;
  categoryId: number;
  priceCents: number;
}

export interface Order {
  id: number;
  eventId: number;
  eventTitle: string;
  status: OrderStatus;
  totalCents: number;
  expiresAt: string;
  createdAt: string;
  paidAt: string | null;
  seats: OrderSeat[];
  serverTime: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
}

export type WaitlistState =
  | { status: "none" }
  | { status: "waiting"; position: number }
  | { status: "notified"; priorityUntil: string };

export interface DashboardRow {
  eventId: number;
  title: string;
  totalSeats: number;
  soldSeats: number;
  heldSeats: number;
  fillRate: number;
  revenueCents: number;
  expiredOrders: number;
  pendingOrders: number;
  refundedOrders: number;
}

export interface NewEventInput {
  title: string;
  venue: string;
  startsAt: string;
  seatsPerRow: number;
  categories: { name: string; priceCents: number; rows: number }[];
}

// Messages WebSocket (serveur -> client uniquement)
export type SocketMessage =
  | { type: "seats_changed"; seats: { id: number; status: SeatStatus }[] }
  | { type: "waitlist_notified"; userId: number; priorityUntil: string };
