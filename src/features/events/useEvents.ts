import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "../../api/events";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],   // identifiant du cache
    queryFn: fetchEvents,   // comment récupérer la donnée
    staleTime: 30_000,      // frais pendant 30 s : pas de refetch inutile
  });
}