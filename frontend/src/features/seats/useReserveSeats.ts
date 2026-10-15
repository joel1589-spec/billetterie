import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reserveSeats } from "../../api/events";
import type { Seat } from "../../types/domain";
import { seatsKey } from "./useSeats";

/**
 * Mise à jour OPTIMISTE : au clic, les sièges passent tout de suite à "réservé par moi".
 * Si le serveur répond 409 (quelqu'un a été plus rapide), on annule (rollback) et on resynchronise.
 */
export function useReserveSeats(eventId: number) {
  const qc = useQueryClient();
  const key = seatsKey(eventId);

  return useMutation({
    mutationFn: (seatIds: number[]) => reserveSeats(eventId, seatIds),

    onMutate: async (seatIds) => {
      await qc.cancelQueries({ queryKey: key }); // un refetch en vol écraserait notre optimisme
      const previous = qc.getQueryData<Seat[]>(key);
      qc.setQueryData<Seat[]>(key, (old) =>
        old?.map((s) => (seatIds.includes(s.id) ? { ...s, status: "held", mine: true } : s)),
      );
      return { previous };
    },

    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous); // rollback
    },

    // Succès ou échec : la vérité est côté serveur, on se recale.
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
