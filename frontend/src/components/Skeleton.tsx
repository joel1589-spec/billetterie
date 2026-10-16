export function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;
}

export function EventGridSkeleton() {
  return (
    <div className="grid" role="status" aria-busy="true">
      <span className="sr-only">Chargement des événements…</span>
      {[0, 1, 2].map((i) => (
        <div className="card evcard" key={i}>
          <Skeleton h={130} />
          <div className="evbody"><Skeleton h={22} w="70%" /><Skeleton h={14} w="50%" /><Skeleton h={8} /><Skeleton h={38} /></div>
        </div>
      ))}
    </div>
  );
}
