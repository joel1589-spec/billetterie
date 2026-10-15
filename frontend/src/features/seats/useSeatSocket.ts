import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Seat, SocketMessage } from "../../types/domain";
import { seatsKey } from "./useSeats";

export type SocketState = "connecting" | "open" | "reconnecting";

/**
 * WebSocket de l'événement :
 *  - chaque message "seats_changed" patche le cache React Query (l'UI suit toute seule) ;
 *  - à chaque (re)connexion on RECHARGE l'état complet : pendant une coupure, des messages
 *    ont été perdus, reconnecter ne suffit donc pas ;
 *  - reconnexion avec délai exponentiel + jitter pour ne pas assommer le serveur.
 */
export function useSeatSocket(eventId: number, onMessage?: (m: SocketMessage) => void) {
  const qc = useQueryClient();
  const [state, setState] = useState<SocketState>("connecting");
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closedByUs = false;
    const key = seatsKey(eventId);

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws/events/${eventId}/`);

      ws.onopen = () => {
        attempt = 0;
        setState("open");
        // Resynchronisation : on ne fait confiance qu'à l'état serveur.
        qc.invalidateQueries({ queryKey: key });
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as SocketMessage;
        if (msg.type === "seats_changed") {
          const changes = new Map(msg.seats.map((s) => [s.id, s.status]));
          qc.setQueryData<Seat[]>(key, (old) =>
            old?.map((s) => {
              const status = changes.get(s.id);
              if (!status) return s;
              // un siège redevenu libre n'est plus "à moi"
              return { ...s, status, mine: status === "available" ? false : s.mine };
            }),
          );
          qc.invalidateQueries({ queryKey: ["events"], exact: true }); // compteurs de la liste
        }
        handler.current?.(msg);
      };

      ws.onclose = () => {
        if (closedByUs) return;
        setState("reconnecting");
        const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
      // onerror est toujours suivi de onclose : un seul chemin de reconnexion.
    };

    const onOnline = () => {
      if (ws?.readyState !== WebSocket.OPEN) {
        clearTimeout(timer);
        attempt = 0;
        connect();
      }
    };
    window.addEventListener("online", onOnline);
    connect();

    return () => {
      closedByUs = true;
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      ws?.close();
    };
  }, [eventId, qc]);

  return state;
}
