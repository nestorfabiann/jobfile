export default function Loading() {
  const bar = (h: number, w = '100%') => <div className="skel" style={{ height: h, width: w, borderRadius: 12 }} />;
  return (
    <div role="status" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
      {bar(28, '55%')}{bar(14, '80%')}{bar(84)}{bar(84)}
    </div>
  );
}
