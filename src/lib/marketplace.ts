import { createHash } from 'node:crypto';
import { notFound } from 'next/navigation';

/** The marketplace is off until MARKETPLACE_ENABLED=true. Every page and action calls requireMarketplace(). */
export const marketplaceEnabled = () => process.env.MARKETPLACE_ENABLED === 'true';
export function requireMarketplace() {
  if (!marketplaceEnabled()) notFound();
}

export const MAX_OPEN_LISTINGS = 5;
export const MAX_LISTINGS_PER_DAY = 10;
export const MAX_BIDS_PER_DAY = 30;
export const AI_DAILY_LIMIT = 10;

/** Tap-to-pick scope items per job type. Groups help homeowners scan; the labels become the written scope. */
export const JOB_TYPES: Record<string, { size: number; sizeLabel: string; groups: [string, string[]][] }> = {
  'Kitchen remodel': {
    size: 200, sizeLabel: 'Kitchen size (sq ft)',
    groups: [
      ['Layout', ['Keep current layout', 'Gut and rebuild', 'Add an island']],
      ['Cabinets', ['New semi-custom cabinets', 'Reface existing cabinets', 'Paint existing cabinets']],
      ['Countertops', ['Quartz', 'Granite', 'Laminate']],
      ['Backsplash', ['Tile backsplash']],
      ['Flooring', ['New tile floor', 'Luxury vinyl plank', 'Hardwood']],
      ['Lighting and electrical', ['New lighting', 'Under-cabinet lights', 'Move outlets or add circuits']],
      ['Plumbing and appliances', ['New sink and faucet', 'Install appliances (I supply them)']],
    ],
  },
  Bathroom: {
    size: 60, sizeLabel: 'Bathroom size (sq ft)',
    groups: [
      ['Shower or tub', ['Walk-in shower', 'Replace the tub', 'Shower over tub refresh', 'Glass shower door']],
      ['Vanity', ['Single vanity', 'Double vanity']],
      ['Tile', ['New tile floor', 'Tile on shower walls']],
      ['Fixtures', ['New toilet', 'Lighting and fan']],
      ['Finish', ['Fresh paint']],
    ],
  },
  Painting: {
    size: 1800, sizeLabel: 'Home size (sq ft)',
    groups: [
      ['Inside', ['Walls', 'Ceilings', 'Trim and doors', 'Cabinets']],
      ['Outside', ['Exterior paint', 'Pressure washing']],
      ['Prep', ['Drywall repair', 'Popcorn ceiling removal']],
    ],
  },
  Roofing: {
    size: 2000, sizeLabel: 'Roof size (sq ft)',
    groups: [
      ['Replace', ['Asphalt shingles', 'Metal roof']],
      ['Repair', ['Fix leaks', 'Flashing and vents']],
      ['Add-ons', ['Gutters']],
    ],
  },
  Flooring: {
    size: 600, sizeLabel: 'Area (sq ft)',
    groups: [
      ['New floor', ['Luxury vinyl plank', 'Hardwood', 'Tile', 'Carpet']],
      ['Prep', ['Remove old flooring']],
      ['Finish', ['New baseboards']],
    ],
  },
  Landscaping: {
    size: 1500, sizeLabel: 'Yard area (sq ft)',
    groups: [
      ['Lawn', ['Sod', 'Sprinkler system']],
      ['Hardscape', ['Patio pavers', 'Fence']],
      ['Plants', ['Flower beds and mulch', 'Tree trimming']],
    ],
  },
};

/** Keeps only items that really exist for that job type, so nothing made up gets stored. */
export function cleanItems(jobType: string, picked: string[]): { group: string; item: string }[] {
  const t = JOB_TYPES[jobType];
  if (!t) return [];
  const out: { group: string; item: string }[] = [];
  const seen = new Set<string>();
  for (const [group, items] of t.groups) for (const item of items) if (picked.includes(item) && !seen.has(item)) { seen.add(item); out.push({ group, item }); }
  return out;
}

export const inputHash = (jobType: string, items: string[], size: number | null, zip: string, details: string) =>
  createHash('sha256').update(JSON.stringify([jobType, [...items].sort(), size, zip, details.trim()])).digest('hex');

export const listingTitle = (l: { job_type: string; items: string[] }) =>
  l.items.length ? `${l.job_type}: ${l.items.slice(0, 2).join(', ')}${l.items.length > 2 ? ` +${l.items.length - 2} more` : ''}` : l.job_type;

export const scopeText = (l: { job_type: string; items: string[]; size_sqft: number | null; details: string }) =>
  [`Job: ${l.job_type}`, l.size_sqft ? `Size: ${l.size_sqft.toLocaleString('en-US')} sq ft` : '', l.items.length ? `Scope:\n${l.items.map((i) => `• ${i}`).join('\n')}` : '', l.details ? `Homeowner notes: ${l.details}` : '']
    .filter(Boolean)
    .join('\n');

export const firstNameInitial = (n: string) => {
  const p = n.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'A homeowner';
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0];
};

export type Listing = {
  id: string; homeowner_id: string; homeowner_name: string; job_type: string; items: string[]; details: string;
  size_sqft: number | null; zip: string; city: string; address: string; is_homestead: boolean;
  budget_min_cents: number | null; budget_max_cents: number | null;
  ai_low_cents: number | null; ai_high_cents: number | null; ai_likely_cents: number | null; ai_confidence: string | null;
  ai_breakdown: { group: string; low: number; high: number }[]; ai_notes: string;
  status: 'open' | 'awarded' | 'closed'; expires_at: string; awarded_bid_id: string | null; project_id: string | null; created_at: string;
};
export type Bid = {
  id: string; listing_id: string; company_id: string; bidder_id: string; price_cents: number; weeks: number | null; start_date: string | null;
  inclusions: string; note: string; status: 'waiting' | 'won' | 'not_selected' | 'withdrawn'; created_at: string; updated_at: string;
};
export const listingOpen = (l: { status: string; expires_at: string }) => l.status === 'open' && new Date(l.expires_at).getTime() > Date.now();

/** Where a price sits against the AI range, for the comparison bar: 0 to 100, clamped. */
export function barPos(price: number, lo: number, hi: number) {
  const span = hi - lo || 1;
  const rangeStart = 18, rangeEnd = 78; // the range is drawn between 18% and 78% of the bar
  const p = rangeStart + ((price - lo) / span) * (rangeEnd - rangeStart);
  return Math.max(2, Math.min(98, p));
}
