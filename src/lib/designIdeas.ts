/**
 * AI design ideas from a photo. OFF until DESIGN_IDEAS_ENABLED=true and DESIGN_IMAGE_KEY is set in Vercel.
 * DESIGN_PROVIDER = gemini (default) or openai. DESIGN_MODEL optionally overrides the model name.
 * Ideas are pictures only: never a plan, never a price.
 */
export const DESIGN_BUCKET = 'design-ideas';
export const DESIGN_DAILY_LIMIT = 3;
export const designEnabled = () => process.env.DESIGN_IDEAS_ENABLED === 'true' && !!process.env.DESIGN_IMAGE_KEY;

export const SPACES = { kitchen: 'Kitchen', bathroom: 'Bathroom' } as const;
export type Space = keyof typeof SPACES;
export const STYLES = ['Modern', 'Farmhouse', 'Traditional', 'Coastal'] as const;

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
  const changes = Object.entries(picks).filter(([, v]) => !/^keep/i.test(v)).map(([k, v]) => `${k.toLowerCase()}: ${v}`);
  const lines = [
    `Edit this photo of a ${SPACES[space].toLowerCase()} into a realistic redesign idea.`,
    `Keep the room's layout, walls, windows, doors and camera angle exactly the same. Only change finishes and materials.`,
    style ? `Overall style: ${style}.` : '',
    changes.length ? `Changes to make: ${changes.join('; ')}.` : 'Choose a tasteful update to colors and finishes.',
    notes ? `Homeowner notes: ${notes}` : '',
    variant === 1 ? 'Make this version a bit bolder in color.' : 'Make this version calm and timeless.',
    'No people, no text, no logos.',
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
