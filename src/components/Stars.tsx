export default function Stars({ n, small = false }: { n: number; small?: boolean }) {
  return (
    <span className={`rstars${small ? ' sm' : ''}`} role="img" aria-label={`${n.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(n) ? 'on' : ''} aria-hidden="true">★</span>
      ))}
    </span>
  );
}
