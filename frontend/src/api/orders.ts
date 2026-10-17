import { api } from "./client";
import type { Order } from "../types/domain";

export const fetchOrder = (id: number) => api<Order>(`/orders/${id}/`);
export const fetchPendingOrders = (eventId: number) =>
  api<Order[]>(`/orders/?event=${eventId}&status=pending`);
export const payOrder = (id: number) => api<{ detail: string }>(`/orders/${id}/pay/`, { method: "POST" });
export const cancelOrder = (id: number) => api<Order>(`/orders/${id}/cancel/`, { method: "POST" });

export const fetchMyOrders = () => api<Order[]>("/orders/");
