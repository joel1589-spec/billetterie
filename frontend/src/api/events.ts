import { api } from "./client";
import type { Event, Order, Seat, WaitlistState } from "../types/domain";

export const fetchEvents = () => api<Event[]>("/events/");
export const fetchEvent = (id: number) => api<Event>(`/events/${id}/`);
export const fetchSeats = (id: number) => api<Seat[]>(`/events/${id}/seats/`);

export const reserveSeats = (eventId: number, seatIds: number[]) =>
  api<Order>(`/events/${eventId}/reserve/`, { method: "POST", body: { seatIds } });

export const fetchWaitlist = (eventId: number) => api<WaitlistState>(`/events/${eventId}/waitlist/`);
export const joinWaitlist = (eventId: number) =>
  api<WaitlistState>(`/events/${eventId}/waitlist/`, { method: "POST" });
export const leaveWaitlist = (eventId: number) =>
  api<void>(`/events/${eventId}/waitlist/`, { method: "DELETE" });
