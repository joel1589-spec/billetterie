import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWaitlist, joinWaitlist, leaveWaitlist } from "../../api/events";
import { useCountdown } from "../orders/useCountdown";

export const waitlistKey = (eventId: number) => ["events", eventId, "waitlist"] as const;

function PriorityBanner({ until }: { until: string }) {
  const { label } = useCountdown(until, 0);
  return (
    <p role="status" className="banner ok">
      🎉 Des places se sont libérées : vous êtes prioritaire pendant encore <strong>{label}</strong>.
    </p>
  );
}

export function WaitlistPanel({ eventId, soldOut }: { eventId: number; soldOut: boolean }) {
  const qc = useQueryClient();
  const { data, status } = useQuery({ queryKey: waitlistKey(eventId), queryFn: () => fetchWaitlist(eventId) });
  const refresh = () => qc.invalidateQueries({ queryKey: waitlistKey(eventId) });
  const join = useMutation({ mutationFn: () => joinWaitlist(eventId), onSuccess: refresh });
  const leave = useMutation({ mutationFn: () => leaveWaitlist(eventId), onSuccess: refresh });

  if (status === "pending") return <p role="status">Chargement de la liste d'attente…</p>;
  if (status === "error") return null;

  if (data.status === "notified") return <PriorityBanner until={data.priorityUntil} />;
  if (data.status === "waiting") {
    return (
      <div className="banner">
        <p>Vous êtes en liste d'attente (position {data.position}).</p>
        <button onClick={() => leave.mutate()} disabled={leave.isPending}>Quitter la liste</button>
      </div>
    );
  }
  if (!soldOut) return null;
  return (
    <div className="banner">
      <p>Cet événement est complet.</p>
      <button onClick={() => join.mutate()} disabled={join.isPending}>M'inscrire en liste d'attente</button>
      {join.isError && <p role="alert">{join.error.message}</p>}
    </div>
  );
}
