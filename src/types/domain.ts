export type SeatStatus = "available" | "held" | "sold";
export type OrderStatus = "pending" | "paid" | "expired" | "cancelled" | "refunded";

export interface PriceCategory {
  id: number;
  name: string;        
  priceCents: number; 
}

export interface Event {
  id: number;
  title: string;
  startsAt: string; 
  venue: string;
  categories: PriceCategory[];
  availableSeats: number;
  totalSeats: number;
}