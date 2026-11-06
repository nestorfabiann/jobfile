/**
 * AI design ideas from a photo. OFF until DESIGN_IDEAS_ENABLED=true and DESIGN_IMAGE_KEY is set in Vercel.
 * DESIGN_PROVIDER = gemini (default) or openai. DESIGN_MODEL optionally overrides the model name.
 * Ideas are pictures only: never a plan, never a price.
 */
export const DESIGN_BUCKET = 'design-ideas';
export const DESIGN_DAILY_LIMIT = 3;
export const designEnabled = () => process.env.DESIGN_IDEAS_ENABLED === 'true' && !!process.env.DESIGN_IMAGE_KEY;

export const SPACES = { kitchen: 'Kitchen', bathroom: 'Bathroom', exterior: 'Exterior', living: 'Living room', bedroom: 'Bedroom', colors: 'Wall colors' } as const;
export type Space = keyof typeof SPACES;
export const SPACE_LIST: { key: Space; label: string; sub: string; icon: string; isNew?: boolean }[] = [
  { key: 'kitchen', label: 'Kitchen', sub: 'Cabinets, counters, floor', icon: '🍳' },
  { key: 'bathroom', label: 'Bathroom', sub: 'Vanity, tile, fixtures', icon: '🛁' },
  { key: 'exterior', label: 'Exterior', sub: 'Paint, trim, siding', icon: '🏠', isNew: true },
  { key: 'living', label: 'Living room', sub: 'Walls, floor, trim', icon: '🛋️', isNew: true },
  { key: 'bedroom', label: 'Bedroom', sub: 'Walls, floor', icon: '🛏️', isNew: true },
  { key: 'colors', label: 'Wall colors only', sub: 'Any room, paint only', icon: '🎨', isNew: true },
];
const NOUN: Record<Space, string> = { kitchen: 'kitchen', bathroom: 'bathroom', exterior: 'front of a house', living: 'living room', bedroom: 'bedroom', colors: 'room' };
/** The job type to start on the Post form for each space. */
export const SPACE_JOB: Record<Space, string> = { kitchen: 'Kitchen remodel', bathroom: 'Bathroom', exterior: 'Painting', living: 'Painting', bedroom: 'Painting', colors: 'Painting' };
export const spaceLabel = (s: string) => (s in SPACES ? SPACES[s as Space] : 'Room');
export const STYLES = ['Modern', 'Farmhouse', 'Traditional', 'Coastal'] as const;

export const OTHER = 'Other (type my own)';
const WALL_COLORS = ['Warm white', 'Bright white', 'Soft gray', 'Charcoal gray', 'Greige', 'Warm beige', 'Cream', 'Tan', 'Pale green', 'Soft sage', 'Deep green', 'Light blue', 'Soft blue', 'Navy', 'Blush pink', 'Terracotta', 'Soft yellow'];
const FLOORS = ['Light wood look', 'Dark wood look', 'Medium oak look', 'Gray wood look', 'Gray tile', 'Large light tile', 'Concrete look', 'Herringbone wood look'];
const CABS = ['White', 'Off white', 'Light gray', 'Charcoal', 'Black', 'Navy', 'Sage green', 'Forest green', 'Natural wood', 'Walnut', 'Two tone: white and wood'];
const METALS = ['Brushed nickel', 'Matte black', 'Brass', 'Chrome', 'Oil rubbed bronze', 'Brushed gold'];
const TRIM = ['White', 'Cream', 'Black', 'Charcoal', 'Light gray'];
const keep = (x: string, ...rest: string[]) => [x, ...rest, OTHER];
export const PICKS: Record<Space, Record<string, string[]>> = {
  kitchen: {
    Cabinets: keep('Keep as they are', ...CABS),
    Countertops: keep('Keep as they are', 'White quartz', 'Gray quartz', 'Black granite', 'Gray granite', 'Marble look', 'Butcher block', 'Concrete look'),
    Backsplash: keep('Keep as it is', 'White subway tile', 'Gray subway tile', 'Marble look tile', 'Green tile', 'Blue tile', 'Natural stone'),
    Floor: keep('Keep as it is', ...FLOORS),
    'Wall color': keep('Keep as it is', ...WALL_COLORS),
  },
  bathroom: {
    Vanity: keep('Keep as it is', 'White', 'Light gray', 'Dark wood', 'Natural wood', 'Navy', 'Black', 'Sage green'),
    'Tile and walls': keep('Keep as they are', 'White subway tile', 'Gray large tile', 'Marble look tile', 'Beige tile', 'Green tile', 'Blue tile', 'Warm beige paint', 'Soft gray paint'),
    Floor: keep('Keep as it is', 'Gray tile', 'Wood look tile', 'Black and white pattern', 'Hex tile', 'Marble look tile', 'Large light tile'),
    Fixtures: keep('Keep as they are', ...METALS),
    'Wall color': keep('Keep as it is', ...WALL_COLORS),
  },
  exterior: {
    'Body color': keep('Keep as it is', 'Warm white', 'Soft gray', 'Greige', 'Tan', 'Sage green', 'Forest green', 'Light blue', 'Navy', 'Charcoal', 'Black', 'Terracotta'),
    'Trim color': keep('Keep as it is', 'White', 'Cream', 'Charcoal', 'Black', 'Dark bronze'),
    'Front door': keep('Keep as it is', 'Navy', 'Black', 'Red', 'Natural wood', 'Sage green', 'Yellow', 'Teal', 'White'),
    'Siding or stone': keep('Keep as it is', 'Board and batten', 'Natural stone accent', 'Brick look', 'Horizontal lap siding', 'Stucco look', 'Cedar shake look'),
    Shutters: keep('Keep as they are', 'None', 'Black', 'Navy', 'Charcoal', 'Green', 'White'),
  },
  living: {
    'Wall color': keep('Keep as it is', ...WALL_COLORS),
    Floor: keep('Keep as it is', ...FLOORS, 'Soft gray carpet'),
    'Trim and doors': keep('Keep as they are', ...TRIM),
    Ceiling: keep('Keep as it is', 'White', 'Soft cream', 'Light gray', 'Wood plank look'),
    'Accent wall': keep('None', 'Navy', 'Deep green', 'Charcoal', 'Terracotta', 'Wood slat look', 'Shiplap'),
  },
  bedroom: {
    'Wall color': keep('Keep as it is', ...WALL_COLORS),
    Floor: keep('Keep as it is', ...FLOORS, 'Soft gray carpet', 'Cream carpet'),
    'Trim and doors': keep('Keep as they are', ...TRIM),
    Ceiling: keep('Keep as it is', 'White', 'Soft cream', 'Light gray'),
    'Accent wall': keep('None', 'Navy', 'Deep green', 'Charcoal', 'Blush pink', 'Wood slat look', 'Shiplap'),
  },
  colors: {
    Walls: keep('Keep as they are', ...WALL_COLORS),
    Trim: keep('Keep as it is', ...TRIM),
    Ceiling: keep('Keep as it is', 'White', 'Soft cream', 'Light gray'),
    'Accent wall': keep('None', 'Navy', 'Deep green', 'Charcoal', 'Terracotta', 'Blush pink', 'Soft blue'),
  },
};

export function cleanPicks(space: Space, raw: Record<string, FormDataEntryValue | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, opts] of Object.entries(PICKS[space])) {
    const v = String(raw[k] ?? '');
    if (v === OTHER) {
      const t = String(raw[`${k}__custom`] ?? '').replace(/[^\p{L}\p{N} ,.'&/-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (t) out[k] = t;
    } else if (opts.includes(v)) out[k] = v;
  }
  return out;
}

export function buildPrompt(space: Space, style: string, picks: Record<string, string>, notes: string, variant: number) {
  const changes = Object.entries(picks).filter(([, v]) => !/^(keep|none)/i.test(v)).map(([k, v]) => `${k.toLowerCase()}: ${v}`);
  const lines = [
    `Edit this photo of a ${NOUN[space]} into a realistic redesign idea.`,
    `Keep the room's layout, walls, windows, doors and camera angle exactly the same.`,
    `Change ONLY the items listed below. Everything else must stay exactly as in the photo: the sink and basin shape, faucet style unless fixtures are listed, mirror and its shape, towels, soap, candles, decor, lighting and any other objects.`,
    style ? `Overall style: ${style}.` : '',
    changes.length ? `Items to change: ${changes.join('; ')}.` : 'Choose a tasteful update to paint colors and finishes only.',
    notes ? `Homeowner notes: ${notes}` : '',
    variant === 1 ? 'Within those items, make this version a bit bolder in color.' : 'Within those items, make this version calm and timeless.',
    space === 'exterior' ? 'Keep the roof, windows, garage, driveway, landscaping, cars and sky unchanged. Only change the listed paint colors and cladding. No people, no text, no license plates.' : 'No people, no text, no logos.',
  ];
  return lines.filter(Boolean).join(' ');
}

/** One picture from the chosen image service. Returns null on any failure. */
export type GenResult = { buf: Buffer | null; outOfCredit: boolean };

/** True when the provider refused because of billing, credit or quota, not because of the photo. */
function creditProblem(status: number, text: string) {
  if (status === 402 || status === 429) return true;
  return /quota|billing|credit|insufficient|resource_exhausted|exceeded your/i.test(text) && status >= 400;
}

export async function generateImageEx(img: Buffer, mime: string, prompt: string): Promise<GenResult> {
  const key = process.env.DESIGN_IMAGE_KEY;
  if (!key) return { buf: null, outOfCredit: false };
  const provider = (process.env.DESIGN_PROVIDER ?? 'gemini').toLowerCase();
  try {
    if (provider === 'openai') {
      const fd = new FormData();
      fd.set('model', process.env.DESIGN_MODEL || 'gpt-image-1');
      fd.set('prompt', prompt);
      fd.set('size', '1024x1024');
      fd.set('image', new Blob([new Uint8Array(img)], { type: mime }), 'room.jpg');
      const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
      if (!r.ok) return { buf: null, outOfCredit: creditProblem(r.status, await r.text().catch(() => '')) };
      const j = (await r.json()) as { data?: { b64_json?: string }[] };
      const b = j.data?.[0]?.b64_json;
      return { buf: b ? Buffer.from(b, 'base64') : null, outOfCredit: false };
    }
    const model = process.env.DESIGN_MODEL || 'gemini-2.5-flash-image';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: img.toString('base64') } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
    if (!r.ok) return { buf: null, outOfCredit: creditProblem(r.status, await r.text().catch(() => '')) };
    const j = (await r.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[] };
    const parts = j.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const d = p.inlineData?.data ?? p.inline_data?.data;
      if (d) return { buf: Buffer.from(d, 'base64'), outOfCredit: false };
    }
    return { buf: null, outOfCredit: false };
  } catch {
    return { buf: null, outOfCredit: false };
  }
}

export async function generateImage(img: Buffer, mime: string, prompt: string): Promise<Buffer | null> {
  return (await generateImageEx(img, mime, prompt)).buf;
}
