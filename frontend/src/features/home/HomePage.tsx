import { Link } from "react-router-dom";
import { useEvents } from "../events/useEvents";
import { EventCard } from "../events/EventCard";
import { EventGridSkeleton } from "../../components/Skeleton";

const FEATURES = [
  { icon: "⚡", title: "Plan en temps réel", text: "Chaque siège pris par un autre spectateur se met à jour sous vos yeux." },
  { icon: "🛡️", title: "Zéro doublon", text: "Une place ne peut jamais être vendue deux fois, même à l'ouverture de la billetterie." },
  { icon: "⏱️", title: "10 minutes pour payer", text: "Vos sièges sont bloqués le temps de finaliser, puis libérés automatiquement." },
  { icon: "♿", title: "Accessible à tous", text: "Plan de salle utilisable au clavier et avec un lecteur d'écran." },
];

const STEPS = [
  { n: 1, title: "Choisissez", text: "Parcourez les événements et sélectionnez jusqu'à 6 sièges sur le plan." },
  { n: 2, title: "Bloquez", text: "Vos places sont réservées pour vous pendant 10 minutes." },
  { n: 3, title: "Payez", text: "Réglez en ligne et recevez la confirmation instantanément." },
];

export function HomePage() {
  const { data, status } = useEvents();
  const upcoming = data?.slice(0, 3) ?? [];

  return (
    <>
      <section className="landing" aria-labelledby="hero-title">
        <div>
          <span className="pill ok">Réservation en direct</span>
          <h1 id="hero-title">Vos prochains spectacles, à la place idéale.</h1>
          <p className="lead">Théâtre, concerts, comédies musicales : choisissez vos sièges sur le plan de la salle et réservez en quelques clics.</p>
          <div className="cta-row">
            <Link className="btn primary lg" to="/events">Découvrir les événements</Link>
            <Link className="btn lg" to="/backoffice">Je suis organisateur</Link>
          </div>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="mini-stage">SCÈNE</div>
          {Array.from({ length: 5 }, (_, r) => (
            <div className="mini-row" key={r}>
              {Array.from({ length: 9 }, (_, c) => {
                const taken = (r * 7 + c * 3) % 5 === 0;
                const picked = r === 2 && (c === 4 || c === 5);
                return <i key={c} className={picked ? "pick" : taken ? "taken" : ""} />;
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="features" aria-label="Nos engagements">
        {FEATURES.map((f) => (
          <div className="card feature" key={f.title}>
            <span className="ficon" aria-hidden="true">{f.icon}</span>
            <h2>{f.title}</h2><p className="muted">{f.text}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="upcoming-title" className="block-section">
        <div className="section-head">
          <h2 id="upcoming-title" className="h2">À l'affiche</h2>
          <Link to="/events">Voir tout →</Link>
        </div>
        {status === "pending" && <EventGridSkeleton />}
        {status === "error" && <p role="alert" className="banner err">Impossible de charger les événements.</p>}
        {status === "success" && upcoming.length === 0 && <p className="card empty">Aucun événement pour le moment, revenez bientôt.</p>}
        {upcoming.length > 0 && <div className="grid">{upcoming.map((e, i) => <EventCard key={e.id} event={e} index={i} />)}</div>}
      </section>

      <section aria-labelledby="how-title" className="block-section">
        <h2 id="how-title" className="h2">Comment ça marche</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li className="card step" key={s.n}><span className="stepnum">{s.n}</span><h3>{s.title}</h3><p className="muted">{s.text}</p></li>
          ))}
        </ol>
      </section>
    </>
  );
}
