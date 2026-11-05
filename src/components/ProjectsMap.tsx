'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type MapJob = { id: string; title: string; trade: string; color: string; price: string; bids: number; away: number | null };
export type MapGroup = { zip: string; lat: number; lng: number; jobs: MapJob[] };

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = LEAFLET_CSS;
      document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => resolve(w.L);
    s.onerror = () => reject(new Error('leaflet'));
    document.head.appendChild(s);
  });
}

/** Contractor map of open projects near them. Pins sit at the ZIP code, never at a house. Tiles are OpenStreetMap. */
export default function ProjectsMap({ me, radiusMi, groups }: { me: { lat: number; lng: number }; radiusMi: number | null; groups: MapGroup[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<MapGroup | null>(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    let map: any;
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !el.current) return;
      map = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([me.lat, me.lng], 10);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      const pts: [number, number][] = [[me.lat, me.lng]];
      if (radiusMi) L.circle([me.lat, me.lng], { radius: radiusMi * 1609.34, color: '#c4813f', weight: 1.5, dashArray: '5 4', fillColor: '#c4813f', fillOpacity: 0.08 }).addTo(map);
      L.marker([me.lat, me.lng], { icon: L.divIcon({ className: 'pm-me', html: '<i></i>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false, keyboard: false }).addTo(map);
      groups.forEach((g) => {
        const many = g.jobs.length > 1;
        const html = many ? `<div class="pm-cl">${g.jobs.length}</div>` : `<div class="pm-pin" style="background:${g.jobs[0].color}"><i>${g.jobs[0].trade.slice(0, 1).toUpperCase()}</i></div>`;
        const icon = L.divIcon({ className: 'pm-ic', html, iconSize: many ? [34, 34] : [26, 26], iconAnchor: many ? [17, 17] : [13, 26] });
        L.marker([g.lat, g.lng], { icon, title: many ? `${g.jobs.length} projects in ${g.zip}` : g.jobs[0].title }).addTo(map).on('click', () => setSel(g));
        pts.push([g.lat, g.lng]);
      });
      // Fit the view to the service area and the pins. Bounds are computed by hand: an unadded circle cannot give its own bounds.
      const dLat = radiusMi ? radiusMi / 69 : 0;
      const dLng = radiusMi ? radiusMi / (69 * Math.max(0.2, Math.cos((me.lat * Math.PI) / 180))) : 0;
      const bounds = L.latLngBounds([[me.lat - dLat, me.lng - dLng], [me.lat + dLat, me.lng + dLng]]);
      pts.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { padding: [16, 16], maxZoom: 12 });
      map.on('click', () => setSel(null));
    }).catch((e) => { console.error('map', e); setFailed(String(e?.message ?? e ?? 'unknown')); });
    return () => { dead = true; if (map) map.remove(); };
  }, [me.lat, me.lng, radiusMi, groups]);

  if (failed) return <div className="box warn">The map could not load. Check your connection and try again, or use the list.<div className="small muted">{failed}</div></div>;
  return (
    <div className="pmap-wrap">
      <div ref={el} className="pmap" role="application" aria-label="Map of open projects near you" />
      {sel && (
        <div className="pmap-sheet">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <b>{sel.jobs.length > 1 ? `${sel.jobs.length} projects in ZIP ${sel.zip}` : sel.jobs[0].title}</b>
            <button type="button" className="pmap-x" aria-label="Close" onClick={() => setSel(null)}>×</button>
          </div>
          {sel.jobs.map((j) => (
            <Link key={j.id} href={`/marketplace/${j.id}`} className="pmap-job">
              <span><span className="dot" style={{ background: j.color }} />{sel.jobs.length > 1 ? j.title : j.trade}</span>
              <span className="muted small">ZIP {sel.zip}{j.away != null ? ` · ${Math.round(j.away)} mi` : ''}{j.price ? ` · ${j.price}` : ''} · {j.bids} bid{j.bids === 1 ? '' : 's'}</span>
              <span className="pmap-go">Open project ›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
