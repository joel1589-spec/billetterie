import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEvent } from "../../api/backoffice";

interface Cat { name: string; price: string; rows: string }

export function CreateEventPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [seatsPerRow, setSeatsPerRow] = useState("10");
  const [cats, setCats] = useState<Cat[]>([{ name: "Standard", price: "20", rows: "5" }]);

  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backoffice"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      navigate("/backoffice");
    },
  });

  const update = (i: number, patch: Partial<Cat>) =>
    setCats((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const totalRows = cats.reduce((s, c) => s + (Number(c.rows) || 0), 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      title,
      venue,
      startsAt: new Date(startsAt).toISOString(),
      seatsPerRow: Number(seatsPerRow),
      categories: cats.map((c) => ({
        name: c.name,
        priceCents: Math.round(Number(c.price) * 100), // euros saisis -> centimes envoyés
        rows: Number(c.rows),
      })),
    });
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h1>Nouvel événement</h1>
      <label>Titre<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
      <label>Lieu<input value={venue} onChange={(e) => setVenue(e.target.value)} required /></label>
      <label>Date et heure
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
      </label>
      <label>Sièges par rangée
        <input type="number" min={1} max={60} value={seatsPerRow} onChange={(e) => setSeatsPerRow(e.target.value)} required />
      </label>

      <fieldset>
        <legend>Catégories (de la scène vers le fond)</legend>
        {cats.map((c, i) => (
          <div className="catrow" key={i}>
            <label>Nom<input value={c.name} onChange={(e) => update(i, { name: e.target.value })} required /></label>
            <label>Prix (€)<input type="number" min={0} step="0.01" value={c.price} onChange={(e) => update(i, { price: e.target.value })} required /></label>
            <label>Rangées<input type="number" min={1} max={50} value={c.rows} onChange={(e) => update(i, { rows: e.target.value })} required /></label>
            {cats.length > 1 && (
              <button type="button" onClick={() => setCats((cs) => cs.filter((_, j) => j !== i))}>Retirer</button>
            )}
          </div>
        ))}
        {cats.length < 6 && (
          <button type="button" onClick={() => setCats((cs) => [...cs, { name: "", price: "0", rows: "1" }])}>
            + Ajouter une catégorie
          </button>
        )}
      </fieldset>

      <p>Total : {totalRows} rangées × {seatsPerRow || 0} sièges = <strong>{totalRows * (Number(seatsPerRow) || 0)}</strong> sièges</p>
      {mutation.isError && <p role="alert" className="error">{mutation.error.message}</p>}
      <button className="primary block" disabled={mutation.isPending || totalRows > 52}>
        {mutation.isPending ? "Création…" : "Créer l'événement et le plan de salle"}
      </button>
    </form>
  );
}
