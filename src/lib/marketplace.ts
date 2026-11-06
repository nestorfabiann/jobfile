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
      ['Layout', ['Keep current layout', 'Gut and rebuild', 'Add an island', 'Open a wall to the living room', 'Add a pantry']],
      ['Cabinets', ['New semi-custom cabinets', 'Reface existing cabinets', 'Paint existing cabinets', 'New cabinet hardware', 'Add crown molding']],
      ['Countertops', ['Quartz', 'Granite', 'Laminate', 'Butcher block', 'Marble or quartzite']],
      ['Backsplash', ['Tile backsplash', 'Stone or slab backsplash']],
      ['Flooring', ['New tile floor', 'Luxury vinyl plank', 'Hardwood', 'Remove old flooring']],
      ['Lighting and electrical', ['New lighting', 'Under-cabinet lights', 'Move outlets or add circuits', 'Recessed lights']],
      ['Plumbing and appliances', ['New sink and faucet', 'Install appliances (I supply them)', 'Move the sink or gas line', 'Garbage disposal', 'Pot filler']],
      ['Finish', ['Fresh paint', 'New window or trim']],
    ],
  },
  Bathroom: {
    size: 60, sizeLabel: 'Bathroom size (sq ft)',
    groups: [
      ['Shower or tub', ['Walk-in shower', 'Replace the tub', 'Shower over tub refresh', 'Glass shower door', 'Bench or niche', 'Grab bars']],
      ['Vanity', ['Single vanity', 'Double vanity', 'New mirror']],
      ['Tile', ['New tile floor', 'Tile on shower walls', 'Heated floor']],
      ['Fixtures and air', ['New toilet', 'Lighting and fan', 'Exhaust fan', 'Towel bars']],
      ['Plumbing', ['Move plumbing', 'New shower valve']],
      ['Finish', ['Fresh paint']],
    ],
  },
  Painting: {
    size: 1800, sizeLabel: 'Home size (sq ft)',
    groups: [
      ['Inside', ['Walls', 'Ceilings', 'Trim and doors', 'Cabinets', 'Accent wall', 'Stairs and railings']],
      ['Outside', ['Exterior paint', 'Pressure washing', 'Front door', 'Fence or deck stain']],
      ['Prep', ['Drywall repair', 'Popcorn ceiling removal', 'Caulk and patch', 'Wallpaper removal']],
    ],
  },
  Roofing: {
    size: 2000, sizeLabel: 'Roof size (sq ft)',
    groups: [
      ['Replace', ['Asphalt shingles', 'Metal roof', 'Tile roof', 'Flat or low slope roof']],
      ['Repair', ['Fix leaks', 'Flashing and vents', 'Storm or hail damage', 'Replace some decking']],
      ['Add-ons', ['Gutters', 'Skylight', 'Attic ventilation', 'Chimney repair']],
    ],
  },
  Flooring: {
    size: 600, sizeLabel: 'Area (sq ft)',
    groups: [
      ['New floor', ['Luxury vinyl plank', 'Hardwood', 'Tile', 'Carpet', 'Laminate', 'Engineered wood', 'Stained concrete']],
      ['Prep', ['Remove old flooring', 'Level the subfloor', 'Move furniture']],
      ['Finish', ['New baseboards', 'Stairs', 'Transition strips']],
    ],
  },
  Landscaping: {
    size: 1500, sizeLabel: 'Yard area (sq ft)',
    groups: [
      ['Lawn', ['Sod', 'Sprinkler system', 'Artificial turf', 'Lawn leveling']],
      ['Hardscape', ['Patio pavers', 'Fence', 'Retaining wall', 'Walkway', 'Fire pit']],
      ['Plants', ['Flower beds and mulch', 'Tree trimming', 'Tree removal', 'New trees and shrubs']],
      ['Water and light', ['Drainage', 'Landscape lighting', 'Drip irrigation']],
    ],
  },
  Plumbing: {
    size: 1800, sizeLabel: 'Home size (sq ft)',
    groups: [
      ['Water heater', ['Tank water heater', 'Tankless water heater', 'Water heater repair']],
      ['Repairs', ['Fix a leak', 'Clear or repair a drain', 'Repair or replace a pipe', 'Slab leak', 'Sewer line repair', 'Outdoor spigot']],
      ['Fixtures', ['New faucets', 'New toilet', 'New sink', 'Garbage disposal', 'Shower or tub valve', 'Dishwasher hookup']],
      ['Larger work', ['Repipe the house', 'New water softener or filter', 'Gas line', 'Move a pipe or fixture']],
    ],
  },
  Electrical: {
    size: 1800, sizeLabel: 'Home size (sq ft)',
    groups: [
      ['Panel and power', ['Panel upgrade', 'Add circuits', 'Whole-home surge protector', 'Fix a tripping breaker', 'Rewire part of the house']],
      ['Outlets and switches', ['New outlets', 'GFCI outlets', 'Dimmers or smart switches']],
      ['Lighting and fans', ['Recessed lighting', 'New light fixtures', 'Ceiling fans', 'Outdoor lighting']],
      ['Add-ons', ['EV charger', 'Generator hookup', 'Smoke and CO detectors', 'Hot tub or pool wiring']],
    ],
  },
  HVAC: {
    size: 1800, sizeLabel: 'Home size (sq ft)',
    groups: [
      ['Replace', ['New AC unit', 'New furnace', 'Full system (AC and furnace)', 'Heat pump', 'Mini split', 'New condenser or coil']],
      ['Repair and tune-up', ['Repair my system', 'Seasonal tune-up']],
      ['Air flow', ['New or repaired ductwork', 'Duct cleaning', 'Smart thermostat', 'Air purifier', 'Attic insulation']],
    ],
  },
  'Windows and doors': {
    size: 1800, sizeLabel: 'Home size (sq ft)',
    groups: [
      ['Windows', ['Replace windows', 'Energy-efficient windows', 'Window screens', 'Repair a window', 'Bay or picture window']],
      ['Doors', ['Entry door', 'Patio or sliding door', 'Interior doors', 'Storm door', 'French doors', 'Garage entry door', 'Door hardware or lock']],
      ['Finish', ['New trim and casing', 'Seal and caulk']],
    ],
  },
  'Siding and exterior': {
    size: 1800, sizeLabel: 'Home size (sq ft)',
    groups: [
      ['Siding', ['Replace siding', 'Repair siding', 'Fiber cement', 'Vinyl', 'Brick or stone veneer', 'Stucco repair', 'Board and batten']],
      ['Trim', ['Soffit and fascia', 'Exterior trim', 'Shutters', 'Wood rot repair']],
      ['Water', ['New gutters', 'Gutter guards', 'Downspouts and drainage']],
    ],
  },
  Fencing: {
    size: 1500, sizeLabel: 'Yard size (sq ft)',
    groups: [
      ['New fence', ['Wood fence', 'Vinyl fence', 'Metal or wrought iron', 'Chain link', 'Privacy fence', 'Remove old fence']],
      ['Gates', ['Walk gate', 'Driveway gate', 'Gate opener']],
      ['Repair', ['Repair sections', 'Replace posts', 'Stain or seal']],
    ],
  },
  'Decks and patios': {
    size: 200, sizeLabel: 'Deck or patio size (sq ft)',
    groups: [
      ['Build', ['New wood deck', 'New composite deck', 'Covered patio', 'Pergola', 'Outdoor kitchen', 'Screened porch']],
      ['Repair', ['Repair deck boards', 'Replace railings', 'Replace stairs']],
      ['Finish', ['Stain or seal', 'Add lighting', 'Add a ceiling fan', 'Pavers or stone surface']],
    ],
  },
  'Concrete and driveways': {
    size: 400, sizeLabel: 'Area (sq ft)',
    groups: [
      ['New', ['Driveway', 'Walkway', 'Patio slab', 'Garage slab', 'Driveway extension', 'Steps']],
      ['Repair', ['Fix cracks', 'Level a sunken slab', 'Replace a section']],
      ['Finish', ['Stamped or decorative', 'Seal the surface', 'Remove old concrete']],
    ],
  },
  'Drywall and carpentry': {
    size: 400, sizeLabel: 'Area (sq ft)',
    groups: [
      ['Drywall', ['Repair holes or water damage', 'Hang new drywall', 'Texture and finish', 'Popcorn ceiling removal', 'Sound or fire rated wall']],
      ['Trim', ['Baseboards', 'Crown molding', 'Door and window casing', 'Wainscoting', 'Mantel']],
      ['Custom', ['Built-in shelves', 'Hang or replace doors', 'Wall paneling', 'New wall or partition', 'Stair repair', 'Closet system']],
    ],
  },
  Garage: {
    size: 400, sizeLabel: 'Garage size (sq ft)',
    groups: [
      ['Door', ['Replace the garage door', 'Repair the garage door', 'New opener', 'Insulated door']],
      ['Floor', ['Epoxy floor coating', 'Repair the floor', 'Floor tiles or mats']],
      ['Storage', ['Shelving and cabinets', 'Overhead racks', 'Workbench', 'Wall slat system']],
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
  answers?: Record<string, string> | null;
  visit_pref?: 'yes' | 'maybe' | 'no'; visit_free?: string;
  status: 'open' | 'awarded' | 'closed'; expires_at: string; awarded_bid_id: string | null; project_id: string | null; created_at: string;
};
export type Bid = {
  id: string; listing_id: string; company_id: string; bidder_id: string; price_cents: number; weeks: number | null; start_date: string | null;
  inclusions: string; note: string; status: 'waiting' | 'won' | 'not_selected' | 'withdrawn'; created_at: string; updated_at: string;
};
export const listingOpen = (l: { status: string; expires_at: string }) => l.status === 'open' && new Date(l.expires_at).getTime() > Date.now();

export { barPos } from './barPos';
