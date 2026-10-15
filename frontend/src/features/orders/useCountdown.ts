import { useEffect, useState } from "react";

/**
 * Compte à rebours basé sur `expiresAt` (heure SERVEUR), jamais sur un "10 minutes" local :
 * restant = expiresAt - maintenant, recalculé à chaque tick. Ainsi la veille de l'onglet
 * ne fausse rien. `clockOffsetMs` = heure serveur - heure locale, pour corriger une
 * horloge locale fausse.
 */
export function useCountdown(expiresAt: string | undefined, clockOffsetMs: number) {
  const compute = () =>
    expiresAt ? Math.max(0, Date.parse(expiresAt) - (Date.now() + clockOffsetMs)) : 0;
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    const id = setInterval(() => setRemaining(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, clockOffsetMs]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return { remainingMs: remaining, seconds: totalSeconds, label: `${mm}:${ss}` };
}
