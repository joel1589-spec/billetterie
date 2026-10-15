import { useQuery } from "@tanstack/react-query";
import { fetchSeats } from "../../api/events";

export const seatsKey = (eventId: number) => ["events", eventId, "seats"] as const;

export function useSeats(eventId: number) {
  return useQuery({ queryKey: seatsKey(eventId), queryFn: () => fetchSeats(eventId) });
}
