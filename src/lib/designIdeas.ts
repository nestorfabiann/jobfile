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

const WALLS = ['Keep as they are', 'Warm white', 'Soft gray', 'Pale green', 'Soft sage', 'Warm beige'];
export const PICKS: Record<Space, Record<string, string[]>> = {
  kitchen: {
    Cabinets: ['Keep as they are', 'White', 'Navy', 'Sage green', 'Natural wood'],
    Countertops: ['Keep as they are', 'White quartz', 'Gray granite', 'Butcher block'],
    Floor: ['Keep as it is', 'Light wood look', 'Dark wood look', 'Gray tile'],
    'Wall color': ['Keep as it is', 'Warm white', 'Soft gray', 'Pale green'],
  },
  bathroom: {
    Vanity: ['Keep as it is', 'White', 'Dark wood', 'Navy'],
    'Tile and walls': ['Keep as they are', 'White subway tile', 'Gray large tile', 'Warm beige'],
    Floor: ['Keep as it is', 'Gray tile', 'Wood look tile', 'Black and white pattern'],
    Fixtures: ['Keep as they are', 'Brushed nickel', 'Matte black', 'Brass'],
  },
  exterior: {
    'Body color': ['Keep as it is', 'Warm white', 'Soft gray', 'Greige', 'Sage green', 'Navy', 'Charcoal'],
    'Trim color': ['Keep as it is', 'White', 'Charcoal', 'Black', 'Cream'],
    'Front door': ['Keep as it is', 'Navy', 'Black', 'Red', 'Natural wood', 'Sage green'],
    'Siding or stone': ['Keep as it is', 'Board and batten', 'Natural stone accent', 'Brick look'],
  },
  living: {
    'Wall color': WALLS.map((w) => (w === 'Keep as they are' ? 'Keep as it is' : w)),
    Floor: ['Keep as it is', 'Light wood look', 'Dark wood look', 'Gray tile'],
    'Trim and doors': ['Keep as they are', 'White', 'Black', 'Cream'],
    Ceiling: ['Keep as it is', 'White', 'Soft cream'],
  },
  bedroom: {
    'Wall color': WALLS.map((w) => (w === 'Keep as they are' ? 'Keep as it is' : w)),
    Floor: ['Keep as it is', 'Light wood look', 'Dark wood look', 'Soft gray carpet'],
    'Trim and doors': ['Keep as they are', 'White', 'Black', 'Cream'],
    Ceiling: ['Keep as it is', 'White', 'Soft cream'],
  },
  colors: {
    Walls: WALLS,
    Trim: ['Keep as it is', 'White', 'Cream', 'Black'],
    'Accent wall': ['None', 'Navy', 'Deep green', 'Charcoal', 'Terracotta'],
  },
};

export function cleanPicks(space: Space, raw: Record<string, FormDataEntryValue | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, opts] of Object.entries(PICKS[space])) {
    const v = String(raw[k] ?? '');
    if (opts.includes(v)) out[k] = v;
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
export async function generateImage(img: Buffer, mime: string, prompt: string): Promise<Buffer | null> {
  const key = process.env.DESIGN_IMAGE_KEY;
  if (!key) return null;
  const provider = (process.env.DESIGN_PROVIDER ?? 'gemini').toLowerCase();
  try {
    if (provider === 'openai') {
      const fd = new FormData();
      fd.set('model', process.env.DESIGN_MODEL || 'gpt-image-1');
      fd.set('prompt', prompt);
      fd.set('size', '1024x1024');
      fd.set('image', new Blob([new Uint8Array(img)], { type: mime }), 'room.jpg');
      const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
      if (!r.ok) return null;
      const j = (await r.json()) as { data?: { b64_json?: string }[] };
      const b = j.data?.[0]?.b64_json;
      return b ? Buffer.from(b, 'base64') : null;
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
    if (!r.ok) return null;
    const j = (await r.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[] };
    const parts = j.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const d = p.inlineData?.data ?? p.inline_data?.data;
      if (d) return Buffer.from(d, 'base64');
    }
    return null;
  } catch {
    return null;
  }
}
