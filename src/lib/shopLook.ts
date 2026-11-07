/**
 * "Shop this look": plain descriptions and store search links for the items a homeowner picked for an AI idea.
 * Built from the picks only. No extra AI call. Links are searches for something similar, never a promise of stock.
 */
export type Kind = 'paint' | 'tile' | 'floor' | 'stone' | 'fixture' | 'cabinet' | 'exterior';
export type ShopItem = { label: string; desc: string; query: string; kind: Kind; swatch: string };
export type Store = { name: string; url: string };

const skip = (v: string) => !v || /^(keep|none)/i.test(v.trim());

const COLOR_WORDS: [RegExp, string][] = [
  [/navy/i, '#2c3a4a'], [/charcoal/i, '#3a3d42'], [/black/i, '#1b1a18'], [/sage/i, '#9aab8c'], [/forest|deep green|green/i, '#4a6b4f'],
  [/pale green/i, '#c9d8c2'], [/light blue|soft blue/i, '#bcd2e3'], [/blue/i, '#5d86b0'], [/blush|pink/i, '#e9c7c4'], [/terracotta/i, '#c4694a'],
  [/yellow/i, '#e5c24a'], [/red/i, '#a8352b'], [/teal/i, '#2f7f84'], [/greige/i, '#cfc6b8'], [/beige|tan/i, '#d9c7a6'], [/cream/i, '#f3ead3'],
  [/warm white|bright white|white/i, '#f6f4ef'], [/light gray|soft gray|gray|grey/i, '#bfc3c7'], [/brass|gold/i, '#b79b4f'], [/nickel|chrome/i, '#c5c8cc'],
  [/bronze/i, '#5b4632'], [/walnut|dark wood/i, '#5a3e2b'], [/oak|wood|butcher/i, '#c9a272'], [/marble/i, '#e7e5e1'], [/concrete|stone/i, '#a9a8a4'],
];
const swatchOf = (t: string) => COLOR_WORDS.find(([re]) => re.test(t))?.[1] ?? '#e4dccf';
const lc = (s: string) => s.trim().toLowerCase();

/** Items from the picks for one idea set. Anything kept as is, or typed in a way we cannot place, is left out. */
export function shopItems(space: string, picks: Record<string, string>): ShopItem[] {
  const out: ShopItem[] = [];
  const add = (label: string, desc: string, query: string, kind: Kind, colorText: string) => out.push({ label, desc, query, kind, swatch: swatchOf(colorText) });
  for (const [k, raw] of Object.entries(picks ?? {})) {
    const v = String(raw ?? '').trim();
    if (skip(v)) continue;
    const l = lc(v);
    if (space === 'kitchen') {
      if (k === 'Cabinets') add('Cabinet color', `${v} cabinets`, /wood|walnut/i.test(v) ? `${l} kitchen cabinets` : `${l} cabinet paint`, /wood|walnut/i.test(v) ? 'cabinet' : 'paint', v);
      else if (k === 'Countertops') add('Countertop', v, `${l} countertop`, 'stone', v);
      else if (k === 'Backsplash') add('Backsplash', v, `${l} kitchen backsplash`, 'tile', v);
      else if (k === 'Floor') add('Floor', v, `${l} flooring`, 'floor', v);
      else if (k === 'Wall color') add('Wall color', `${v} walls`, `${l} interior wall paint`, 'paint', v);
    } else if (space === 'bathroom') {
      if (k === 'Vanity') add('Vanity', `${v} vanity`, `${l} bathroom vanity`, 'cabinet', v);
      else if (k === 'Tile and walls') add(/paint/i.test(v) ? 'Wall color' : 'Tile', v, /paint/i.test(v) ? `${l}` : `${l} bathroom wall tile`, /paint/i.test(v) ? 'paint' : 'tile', v);
      else if (k === 'Floor') add('Floor', v, `${l} bathroom floor tile`, 'tile', v);
      else if (k === 'Fixtures') add('Faucet and fixtures', `${v} fixtures`, `${l} bathroom faucet`, 'fixture', v);
      else if (k === 'Wall color') add('Wall color', `${v} walls`, `${l} bathroom paint`, 'paint', v);
    } else if (space === 'exterior') {
      if (k === 'Body color') add('House color', `${v}, exterior paint`, `${l} exterior house paint`, 'paint', v);
      else if (k === 'Trim color') add('Trim color', `${v}, exterior trim paint`, `${l} exterior trim paint`, 'paint', v);
      else if (k === 'Front door') add('Front door', `${v} front door`, `${l} front door paint`, 'paint', v);
      else if (k === 'Siding or stone') add('Siding or stone', v, `${l} siding`, 'exterior', v);
      else if (k === 'Shutters') add('Shutters', `${v} shutters`, `${l} exterior shutters`, 'exterior', v);
    } else {
      // living, bedroom, colors
      if (k === 'Wall color' || k === 'Walls') add('Wall color', `${v} walls`, `${l} interior wall paint`, 'paint', v);
      else if (k === 'Floor') add('Floor', v, `${l} flooring`, 'floor', v);
      else if (k === 'Trim and doors' || k === 'Trim') add('Trim and doors', `${v}, semi-gloss trim paint`, `${l} trim paint`, 'paint', v);
      else if (k === 'Ceiling') add('Ceiling', /plank/i.test(v) ? v : `${v} ceiling`, /plank/i.test(v) ? 'wood plank ceiling' : `${l} ceiling paint`, /plank/i.test(v) ? 'floor' : 'paint', v);
      else if (k === 'Accent wall') {
        const panel = /slat|shiplap/i.test(v);
        add('Accent wall', v, panel ? `${l} wall panels` : `${l} interior wall paint`, panel ? 'exterior' : 'paint', v);
      }
    }
  }
  return out.slice(0, 8);
}

const enc = encodeURIComponent;
const site = (host: string) => (q: string) => `https://www.google.com/search?q=${enc(`${q} site:${host}`)}`;

const STORE: Record<string, (q: string) => string> = {
  'Home Depot': (q) => `https://www.homedepot.com/s/${enc(q)}`,
  "Lowe's": (q) => `https://www.lowes.com/search?searchTerm=${enc(q)}`,
  'Floor & Decor': (q) => `https://www.flooranddecor.com/search?q=${enc(q)}`,
  'The Tile Shop': site('tileshop.com'),
  'Sherwin-Williams': site('sherwin-williams.com'),
  'Benjamin Moore': site('benjaminmoore.com'),
  'Ace Hardware': (q) => `https://www.acehardware.com/search?query=${enc(q)}`,
  Ferguson: site('ferguson.com'),
  Wayfair: (q) => `https://www.wayfair.com/keyword.php?keyword=${enc(q)}`,
  Amazon: (q) => `https://www.amazon.com/s?k=${enc(q)}`,
};
const BY_KIND: Record<Kind, string[]> = {
  paint: ['Sherwin-Williams', 'Benjamin Moore', 'Home Depot', "Lowe's", 'Ace Hardware'],
  tile: ['Home Depot', "Lowe's", 'Floor & Decor', 'The Tile Shop', 'Wayfair'],
  floor: ['Home Depot', "Lowe's", 'Floor & Decor', 'Wayfair'],
  stone: ['Home Depot', "Lowe's", 'Floor & Decor', 'Wayfair'],
  fixture: ['Home Depot', "Lowe's", 'Ferguson', 'Wayfair', 'Amazon', 'Ace Hardware'],
  cabinet: ['Home Depot', "Lowe's", 'Wayfair', 'Amazon'],
  exterior: ['Home Depot', "Lowe's", 'Wayfair', 'Amazon'],
};
export const storesFor = (item: ShopItem): Store[] => BY_KIND[item.kind].map((name) => ({ name, url: STORE[name](item.query) }));

/** Store finders near a ZIP. These open Google Maps, which shows the closest locations. They do not show stock. */
const FINDERS = ['Home Depot', "Lowe's", 'Floor & Decor', 'The Tile Shop', 'Sherwin-Williams', 'Ace Hardware', 'Ferguson'];
export const finderLinks = (zip: string): Store[] => FINDERS.map((name) => ({ name, url: `https://www.google.com/maps/search/${enc(`${name} near ${zip}`)}` }));
