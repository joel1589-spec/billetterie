import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PriceCategory, Seat } from "../../types/domain";
import { formatPrice } from "../../components/format";

interface Props {
  seats: Seat[];
  categories: PriceCategory[];
  selected: Set<number>;
  onToggle: (seat: Seat) => void;
}

const STATUS_LABEL = { available: "disponible", held: "en cours de réservation", sold: "vendu" } as const;
// Le statut ne passe pas que par la couleur : chaque état a aussi un symbole.
const SYMBOL = { available: "", held: "⏳", sold: "✕", selected: "✓", mine: "★" } as const;

export function SeatMap({ seats, categories, selected, onToggle }: Props) {
  const rows = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const s of seats) {
      if (!map.has(s.row)) map.set(s.row, []);
      map.get(s.row)!.push(s);
    }
    return [...map.entries()];
  }, [seats]);

  const catIndex = useMemo(() => new Map(categories.map((c, i) => [c.id, i])), [categories]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Roving tabindex : un seul siège est dans l'ordre de tabulation (tabIndex=0).
  const [focusedId, setFocusedId] = useState<number | null>(seats[0]?.id ?? null);
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const activeId = focusedId ?? seats[0]?.id;

  const focusSeat = (seat: Seat | undefined) => {
    if (!seat) return;
    setFocusedId(seat.id);
    refs.current.get(seat.id)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, rowIdx: number, colIdx: number) => {
    const row = rows[rowIdx][1];
    switch (e.key) {
      case "ArrowRight": focusSeat(row[colIdx + 1]); break;
      case "ArrowLeft": focusSeat(row[colIdx - 1]); break;
      case "ArrowDown": focusSeat(rows[rowIdx + 1]?.[1][Math.min(colIdx, rows[rowIdx + 1][1].length - 1)]); break;
      case "ArrowUp": focusSeat(rows[rowIdx - 1]?.[1][Math.min(colIdx, rows[rowIdx - 1][1].length - 1)]); break;
      case "Home": focusSeat(row[0]); break;
      case "End": focusSeat(row[row.length - 1]); break;
      default: return; // Entrée / Espace : comportement natif du <button> (onClick)
    }
    e.preventDefault();
  };

  return (
    <div className="seatmap" role="group" aria-label="Plan de la salle">
      <div className="stage" aria-hidden="true">SCÈNE</div>
      {rows.map(([label, rowSeats], r) => (
        <div className="seatrow" role="group" aria-label={`Rangée ${label}`} key={label}>
          <span className="rowlabel" aria-hidden="true">{label}</span>
          {rowSeats.map((seat, c) => {
            const isSelected = selected.has(seat.id);
            const visual = isSelected ? "selected" : seat.mine ? "mine" : seat.status;
            const cat = catById.get(seat.categoryId);
            const state = isSelected
              ? "sélectionné"
              : seat.mine
                ? "réservé par vous"
                : STATUS_LABEL[seat.status];
            const ariaLabel = `Rangée ${seat.row}, siège ${seat.number}, catégorie ${cat?.name ?? "?"}, ${
              cat ? formatPrice(cat.priceCents) : ""
            }, ${state}`;
            const selectable = seat.status === "available";
            return (
              <button
                key={seat.id}
                type="button"
                ref={(el) => { if (el) refs.current.set(seat.id, el); else refs.current.delete(seat.id); }}
                className={`seat seat-${visual} cat-${(catIndex.get(seat.categoryId) ?? 0) % 6}${c === Math.ceil(rowSeats.length / 2) - 1 && rowSeats.length > 6 ? " aisle" : ""}`}
                tabIndex={seat.id === activeId ? 0 : -1}
                aria-label={ariaLabel}
                aria-pressed={selectable || isSelected ? isSelected : undefined}
                aria-disabled={!selectable && !isSelected}
                onFocus={() => setFocusedId(seat.id)}
                onKeyDown={(e) => onKeyDown(e, r, c)}
                onClick={() => (selectable || isSelected) && onToggle(seat)}
              >
                <span aria-hidden="true">{SYMBOL[visual] || seat.number}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
