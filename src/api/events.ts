import type { Event } from "../types/domain";

const SIMULATE: "ok" | "error" | "empty" = "ok";

const MOCK_EVENTS: Event[] = [
  {
    id: 1,
    title: "Les Misérables",
    startsAt: "2026-12-05T20:00:00Z",
    venue: "Palais des Congrès, Lomé",
    categories: [
      { id: 1, name: "Or", priceCents: 4500 },
      { id: 2, name: "Argent", priceCents: 3000 },
    ],
    availableSeats: 120,
    totalSeats: 300,
  },
  {
    id: 2,
    title: "Concert de jazz",
    startsAt: "2026-12-12T19:30:00Z",
    venue: "Institut Français",
    categories: [{ id: 3, name: "Unique", priceCents: 2000 }],
    availableSeats: 0, 
    totalSeats: 150,
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchEvents(): Promise<Event[]> {
  await sleep(800);
  if (SIMULATE === "error") throw new Error("Impossible de joindre le serveur");
  if (SIMULATE === "empty") return [];
  return MOCK_EVENTS;
}