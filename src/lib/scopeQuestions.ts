/**
 * Detailed scope questions per trade. Answers are stored as { key: "text" } on the listing.
 * Every chip question can have a "Not sure" answer, which bidders see flagged in amber.
 * Pure data and helpers, safe for client and server.
 */
export const NOT_SURE = 'Not sure';

export type Q = { k: string; label: string; short?: string; kind: 'chips' | 'number'; options?: string[]; ns?: boolean; hint?: string; group: string; placeholder?: string; req?: boolean };

const c = (group: string, k: string, label: string, options: string[], o: { ns?: boolean; hint?: string; short?: string; req?: boolean } = {}): Q => ({ group, k, label, kind: 'chips', options, ns: o.ns ?? false, hint: o.hint, short: o.short, req: o.req });
const n = (group: string, k: string, label: string, placeholder: string, o: { hint?: string; short?: string } = {}): Q => ({ group, k, label, kind: 'number', placeholder, hint: o.hint, short: o.short });
const YN = ['Yes', 'No'];

/** Same for every trade. "when" is required to post. */
export const COMMON: Q[] = [
  c('The house and the job', 'when', 'When do you want to start?', ['Within 2 weeks', 'This month', '1 to 3 months', 'Just pricing'], { req: true, short: 'Start' }),
  c('The house and the job', 'flex', 'Is the date flexible?', ['Fixed deadline', 'Somewhat', 'Very flexible'], { short: 'Flexibility' }),
  c('The house and the job', 'home', 'Will you be living there?', ['Yes, living there', 'Empty or vacant', 'Rental, tenants inside'], { short: 'Living there' }),
  c('The house and the job', 'yr', 'When was the house built?', ['Before 1978', '1978 to 2000', 'After 2000'], { ns: true, hint: 'Older homes can have lead paint or asbestos. Contractors price in the safe handling.', short: 'Built' }),
  c('The house and the job', 'st', 'Stories', ['1', '2', '3 or more'], { short: 'Stories' }),
  c('The house and the job', 'acc', 'Getting to the work area', ['Easy, driveway parking', 'Stairs', 'Gated or HOA rules', 'Tight access'], { short: 'Access' }),
  c('The house and the job', 'perm', 'Permits', ['Contractor pulls them', 'I have them'], { ns: true, short: 'Permits' }),
];

const LVL = (g: string) => c(g, 'lvl', 'What level of finish are you aiming for?', ['Budget friendly', 'Mid range', 'High end'], { hint: 'This changes a bid more than anything else.', short: 'Level' });
const MAT = (g: string) => c(g, 'mat', 'Who buys materials?', ['Contractor supplies all', 'I buy some', 'Already bought'], { short: 'Materials' });
const HAUL = (g: string, label = 'Haul away the old material?') => c(g, 'haul', label, ['Yes, contractor hauls', 'No, I will'], { short: 'Haul away' });

export const QUESTIONS: Record<string, Q[]> = {
  'Kitchen remodel': [
    c('About the room', 'shape', 'Shape of the kitchen', ['Galley', 'L-shape', 'U-shape', 'Open to living room'], { ns: true, short: 'Shape' }),
    c('About the room', 'wall', 'Is a wall coming out?', ['No walls', 'Yes, load-bearing', 'Yes, not load-bearing'], { ns: true, hint: 'Load-bearing walls need an engineer and a permit. "Not sure" is fine, the contractor will check.', short: 'Wall removal' }),
    c('Cabinets', 'cab', 'How many cabinets?', ['Under 15', '15 to 25', '25 or more'], { ns: true, hint: 'Count the doors and drawers you see. Wall and base cabinets together.', short: 'Cabinets' }),
    c('Cabinets', 'style', 'Door style', ['Shaker', 'Flat slab', 'Traditional raised'], { ns: true, short: 'Door style' }),
    c('Cabinets', 'fin', 'Finish', ['Painted', 'Stained wood', 'Laminate'], { ns: true, short: 'Finish' }),
    n('Countertops and backsplash', 'ct', 'Counter length (feet, all runs added up)', '24', { short: 'Counter length (ft)' }),
    c('Countertops and backsplash', 'sink', 'Sink', ['Undermount', 'Drop-in', 'Farmhouse'], { ns: true, short: 'Sink' }),
    c('Countertops and backsplash', 'bs', 'Backsplash height', ['4 inches', 'Full height to cabinets', 'Up to the ceiling'], { short: 'Backsplash' }),
    c('Appliances and utilities', 'fuel', 'Range fuel', ['Gas', 'Electric', 'Switching'], { ns: true, short: 'Range' }),
    c('Appliances and utilities', 'hood', 'Range hood', ['None', 'Vents outside', 'Recirculating', 'New vent needed'], { short: 'Hood' }),
    c('Appliances and utilities', 'plmv', 'Is the sink or dishwasher moving?', ['Same spot', 'Moving'], { ns: true, short: 'Plumbing' }),
    LVL('Level of finish'), MAT('Level of finish'),
  ],
  Bathroom: [
    c('About the room', 'count', 'How many bathrooms?', ['1', '2', '3 or more'], { short: 'Bathrooms' }),
    c('About the room', 'kind', 'What kind of bathroom?', ['Full bath', 'Half bath', 'Primary bath', 'Guest bath'], { short: 'Kind' }),
    c('Shower and tub', 'sh', 'Shower or tub plans', ['Walk-in shower', 'Tub and shower', 'Tub to shower', 'Keep as is'], { short: 'Shower or tub' }),
    c('Shower and tub', 'curb', 'Shower entry', ['Curbless', 'With a curb'], { ns: true, short: 'Entry' }),
    c('Shower and tub', 'niche', 'Shower niche (built-in shelf)', YN, { short: 'Niche' }),
    c('Tile', 'tile', 'Tile size', ['Small mosaic', 'Standard (12 inch)', 'Large format'], { ns: true, short: 'Tile size' }),
    c('Tile', 'tileh', 'How high does tile go?', ['Shower only', 'Half wall', 'Floor to ceiling'], { short: 'Tile height' }),
    c('Plumbing and safety', 'plmv', 'Is plumbing moving?', ['Stays in place', 'Moving'], { ns: true, short: 'Plumbing' }),
    c('Plumbing and safety', 'grab', 'Grab bars or senior-friendly changes', YN, { short: 'Grab bars' }),
    c('Plumbing and safety', 'fan', 'Ventilation fan', ['Replace', 'Add new', 'Keep as is'], { short: 'Fan' }),
    LVL('Level of finish'), MAT('Level of finish'),
  ],
  Painting: [
    c('Rooms and surfaces', 'where', 'Inside, outside or both?', ['Inside', 'Outside', 'Both'], { short: 'Where' }),
    n('Rooms and surfaces', 'rooms', 'Number of rooms (inside)', '5', { short: 'Rooms' }),
    c('Rooms and surfaces', 'ceil', 'Ceiling height', ['8 feet', '9 to 10 feet', 'Vaulted or taller'], { ns: true, short: 'Ceiling height' }),
    c('Rooms and surfaces', 'cdark', 'Dark color going to light?', YN, { ns: true, hint: 'Dark-to-light usually needs primer and extra coats.', short: 'Dark to light' }),
    c('Rooms and surfaces', 'prep', 'Wallpaper or texture to remove?', ['Neither', 'Wallpaper', 'Texture', 'Both'], { ns: true, short: 'Removal' }),
    c('Outside', 'ext', 'Exterior material', ['Brick', 'Stucco', 'Wood', 'Siding'], { ns: true, short: 'Exterior material' }),
    c('Outside', 'pre78', 'Is the paint older than 1978?', YN, { ns: true, short: 'Older paint' }),
    c('Furniture', 'furn', 'Furniture', ['Rooms are empty', 'Contractor moves it', 'I will move it'], { short: 'Furniture' }),
    MAT('Furniture'),
  ],
  Roofing: [
    c('The roof', 'pitch', 'Roof pitch', ['Low', 'Medium', 'Steep'], { ns: true, short: 'Pitch' }),
    c('The roof', 'layers', 'Layers of old roofing', ['1', '2', '3 or more'], { ns: true, short: 'Old layers' }),
    c('The roof', 'mat', 'Material you want', ['Standard shingles', 'Premium shingles', 'Metal', 'Tile'], { ns: true, short: 'Material' }),
    n('The roof', 'pen', 'Chimneys, skylights and vents (total count)', '4', { short: 'Penetrations' }),
    c('Problems', 'leak', 'Known leaks?', ['No leaks', 'Yes, one area', 'Yes, several'], { ns: true, short: 'Leaks' }),
    c('Problems', 'ins', 'Is this an insurance claim?', YN, { short: 'Insurance claim' }),
    c('Problems', 'dk', 'Soft or rotted spots suspected?', YN, { ns: true, short: 'Decking damage' }),
    HAUL('Cleanup', 'Haul away old roofing?'),
  ],
  Flooring: [
    n('The rooms', 'rooms', 'Number of rooms', '3', { short: 'Rooms' }),
    c('The rooms', 'kind', 'New floor type', ['Hardwood', 'Engineered wood', 'Luxury vinyl', 'Laminate', 'Tile', 'Carpet'], { ns: true, short: 'New floor' }),
    c('The rooms', 'under', 'What is under the floor?', ['Concrete slab', 'Wood subfloor'], { ns: true, short: 'Under floor' }),
    c('Old floor', 'rem', 'Remove the old floor?', ['Yes', 'No, go over it'], { ns: true, short: 'Remove old' }),
    HAUL('Old floor'),
    n('Details', 'stairs', 'Stairs: how many steps', '0', { short: 'Stair steps' }),
    c('Details', 'furn', 'Furniture moving', ['Rooms are empty', 'Contractor moves it', 'I will move it'], { short: 'Furniture' }),
    c('Details', 'trim', 'Baseboards and transitions', ['Keep current', 'Replace', 'Not needed'], { ns: true, short: 'Trim' }),
  ],
  Landscaping: [
    c('The yard', 'slope', 'Slope of the yard', ['Flat', 'Gentle slope', 'Steep'], { ns: true, short: 'Slope' }),
    c('The yard', 'spr', 'Existing sprinklers', ['None', 'Working', 'Needs repair'], { ns: true, short: 'Sprinklers' }),
    c('The yard', 'gate', 'Gate width for equipment', ['Under 3 feet', '3 to 5 feet', 'Over 5 feet or open'], { ns: true, short: 'Gate width' }),
    c('The work', 'plants', 'Plants', ['Native', 'Low water', 'No preference'], { short: 'Plants' }),
    HAUL('The work', 'Haul away debris?'),
    c('The work', 'hoa', 'HOA rules apply?', YN, { ns: true, short: 'HOA' }),
    LVL('The work'),
  ],
  Plumbing: [
    c('The problem', 'kind', 'What is going on?', ['Leak', 'Clog or slow drain', 'New fixture', 'Water heater', 'Repipe', 'Low pressure'], { short: 'Issue' }),
    c('The problem', 'leakloc', 'Known leak location', ['Inside wall', 'Under a fixture', 'Under the slab', 'Outside'], { ns: true, short: 'Leak location' }),
    c('The problem', 'press', 'Water pressure or color problems?', YN, { ns: true, short: 'Pressure or color' }),
    c('The house', 'found', 'Foundation', ['Slab', 'Pier and beam'], { ns: true, short: 'Foundation' }),
    c('Water heater', 'whloc', 'Where is the water heater?', ['Garage', 'Attic', 'Closet', 'Outside'], { ns: true, short: 'Heater location' }),
    c('Water heater', 'whfuel', 'Gas or electric?', ['Gas', 'Electric'], { ns: true, short: 'Heater fuel' }),
    c('Water heater', 'whtype', 'Tank or tankless?', ['Tank', 'Tankless'], { ns: true, short: 'Heater type' }),
    n('Fixtures', 'fix', 'Number of fixtures involved', '2', { short: 'Fixtures' }),
  ],
  Electrical: [
    c('The system', 'amps', 'Panel size', ['100 amp', '150 amp', '200 amp', 'Fuse box'], { ns: true, short: 'Panel' }),
    c('The system', 'age', 'Age of the panel', ['Under 10 years', '10 to 30 years', 'Over 30 years'], { ns: true, short: 'Panel age' }),
    c('The system', 'trip', 'Breaker trips or flickering lights?', YN, { ns: true, short: 'Trips or flicker' }),
    n('The work', 'cnt', 'Outlets, switches and fixtures (total)', '8', { short: 'Devices' }),
    c('The work', 'ev', 'EV charger?', YN, { short: 'EV charger' }),
    c('The work', 'ev_d', 'Distance from panel to charger', ['Under 20 feet', '20 to 50 feet', 'Over 50 feet'], { ns: true, short: 'Charger distance' }),
    c('Access', 'acc2', 'Attic or crawlspace access', ['Easy attic', 'Crawlspace', 'Slab, no access'], { ns: true, short: 'Wiring access' }),
    c('Access', 'insp', 'City permit and inspection', ['Contractor handles', 'Already done'], { ns: true, short: 'Inspection' }),
  ],
  HVAC: [
    c('Current system', 'kind', 'What are you doing?', ['Replace whole system', 'Replace outdoor unit', 'Replace furnace', 'Repair', 'New install'], { short: 'Job' }),
    c('Current system', 'age', 'Age of current system', ['Under 10 years', '10 to 15 years', 'Over 15 years'], { ns: true, short: 'System age' }),
    c('Current system', 'ton', 'Size (tons)', ['1.5 to 2', '2.5 to 3', '3.5 to 5'], { ns: true, short: 'Tonnage' }),
    c('Equipment', 'indoor', 'Indoor unit location', ['Attic', 'Closet', 'Garage'], { ns: true, short: 'Indoor unit' }),
    c('Equipment', 'heat', 'Heat type', ['Gas', 'Electric heat pump'], { ns: true, short: 'Heat' }),
    c('Equipment', 'duct', 'Condition of ductwork', ['Good', 'Needs repair', 'Replace it'], { ns: true, short: 'Ductwork' }),
    n('Equipment', 'zones', 'Number of zones or thermostats', '1', { short: 'Zones' }),
    c('Equipment', 'eff', 'Efficiency level', ['Standard', 'High efficiency'], { ns: true, short: 'Efficiency' }),
  ],
  'Windows and doors': [
    n('The openings', 'wcnt', 'Number of windows', '8', { short: 'Windows' }),
    n('The openings', 'dcnt', 'Number of doors', '1', { short: 'Doors' }),
    c('The openings', 'floor', 'Floor level', ['Ground floor', 'Second floor or higher', 'Both'], { short: 'Floor' }),
    c('The openings', 'frame', 'Frame material', ['Vinyl', 'Wood', 'Fiberglass'], { ns: true, short: 'Frame' }),
    c('The openings', 'egress', 'Bedroom (egress) windows included?', YN, { ns: true, short: 'Egress windows' }),
    c('Finishing', 'trim', 'Trim, inside and outside', ['Replace both', 'Inside only', 'Outside only', 'Keep'], { short: 'Trim' }),
    c('Finishing', 'hoa', 'HOA approval needed?', YN, { ns: true, short: 'HOA' }),
    LVL('Finishing'),
  ],
  'Siding and exterior': [
    c('The house', 'wall', 'Wall area', ['Under 1,500 sq ft', '1,500 to 2,500 sq ft', 'Over 2,500 sq ft'], { ns: true, short: 'Wall area' }),
    c('The house', 'cur', 'Current material', ['Wood', 'Vinyl', 'Fiber cement', 'Brick or stone', 'Stucco'], { ns: true, short: 'Current' }),
    c('The house', 'rot', 'Rot or water damage suspected?', YN, { ns: true, short: 'Rot or damage' }),
    c('The new look', 'new', 'New material', ['Fiber cement', 'Vinyl', 'Wood', 'Stucco', 'Brick'], { ns: true, short: 'New siding' }),
    c('The new look', 'wrap', 'Insulation or house wrap', ['Replace', 'Keep', 'Add'], { ns: true, short: 'House wrap' }),
    c('The new look', 'color', 'Color and style chosen?', YN, { short: 'Color picked' }),
    c('The new look', 'pre78', 'Is the paint older than 1978?', YN, { ns: true, short: 'Older paint' }),
    LVL('The new look'),
  ],
  Fencing: [
    n('The fence', 'len', 'Length in feet', '150', { short: 'Length (ft)' }),
    c('The fence', 'h', 'Height', ['4 feet', '6 feet', '8 feet'], { short: 'Height' }),
    c('The fence', 'mat', 'Material', ['Wood', 'Cedar', 'Metal', 'Vinyl', 'Chain link'], { ns: true, short: 'Material' }),
    n('The fence', 'gates', 'Number of gates', '1', { short: 'Gates' }),
    c('The site', 'slope', 'Slope or obstacles', ['Flat and clear', 'Some slope', 'Trees or obstacles'], { ns: true, short: 'Site' }),
    c('The site', 'rem', 'Remove an old fence?', YN, { short: 'Remove old' }),
    c('The site', 'shared', 'Shared with a neighbor?', YN, { ns: true, short: 'Shared fence' }),
    c('The site', 'line', 'Property line known or surveyed?', YN, { ns: true, short: 'Line known' }),
    c('The site', 'hoa', 'HOA rules apply?', YN, { ns: true, short: 'HOA' }),
  ],
  'Decks and patios': [
    c('The space', 'sz', 'Size', ['Under 150 sq ft', '150 to 300 sq ft', 'Over 300 sq ft'], { ns: true, short: 'Size' }),
    c('The space', 'ht', 'Height above ground', ['Ground level', 'Under 30 inches', 'Over 30 inches'], { ns: true, short: 'Height' }),
    c('The space', 'att', 'Attached to the house?', ['Attached', 'Freestanding'], { short: 'Attached' }),
    c('The build', 'mat', 'Material', ['Pressure treated wood', 'Cedar', 'Composite', 'Pavers', 'Stamped concrete'], { ns: true, short: 'Material' }),
    c('The build', 'rail', 'Stairs and railing needed?', ['Both', 'Stairs only', 'Railing only', 'Neither'], { short: 'Stairs and rail' }),
    c('The build', 'rem', 'Remove an old deck or patio?', YN, { short: 'Remove old' }),
    c('The build', 'perm', 'Permit and HOA approval', ['Contractor handles', 'Already approved'], { ns: true, short: 'Permit and HOA' }),
    LVL('The build'),
  ],
  'Concrete and driveways': [
    c('The area', 'area', 'Area', ['Under 300 sq ft', '300 to 800 sq ft', 'Over 800 sq ft'], { ns: true, short: 'Area' }),
    c('The area', 'thick', 'Thickness', ['4 inches', '5 to 6 inches'], { ns: true, short: 'Thickness' }),
    c('The area', 'slope', 'Slope and drainage', ['Flat and drains', 'Needs grading', 'Drainage problem'], { ns: true, short: 'Drainage' }),
    c('The work', 'rem', 'Remove old concrete?', YN, { short: 'Remove old' }),
    c('The work', 'truck', 'Truck access', ['Easy', 'Tight', 'Wheelbarrow only'], { ns: true, short: 'Truck access' }),
    c('The work', 'fin', 'Finish', ['Broom', 'Stamped', 'Colored', 'Smooth'], { short: 'Finish' }),
    c('The work', 'rebar', 'Rebar or mesh', ['Rebar', 'Mesh', 'None'], { ns: true, short: 'Reinforcement' }),
  ],
  'Drywall and carpentry': [
    c('The damage', 'wc', 'Walls, ceilings or both?', ['Walls', 'Ceilings', 'Both'], { short: 'Where' }),
    c('The damage', 'area', 'Area to repair or build', ['Small patches', 'One room', 'Several rooms'], { ns: true, short: 'Area' }),
    c('The damage', 'cause', 'Cause of damage', ['Water', 'Impact or holes', 'Settling cracks', 'Remodel', 'None, new work'], { ns: true, short: 'Cause' }),
    c('The damage', 'fixed', 'Is the cause fixed?', YN, { ns: true, short: 'Cause fixed' }),
    c('Finishing', 'tex', 'Texture to match', ['Smooth', 'Orange peel', 'Knockdown', 'Popcorn'], { ns: true, short: 'Texture' }),
    c('Finishing', 'ceil', 'Ceiling height', ['8 feet', '9 to 10 feet', 'Vaulted or taller'], { ns: true, short: 'Ceiling height' }),
    c('Finishing', 'trim', 'Trim style', ['Match existing', 'Modern flat', 'Traditional'], { ns: true, short: 'Trim' }),
    c('Finishing', 'paint', 'Paint after repair?', YN, { short: 'Paint after' }),
  ],
  Garage: [
    c('The garage', 'door', 'Door size', ['Single', 'Double', 'Wider than double'], { ns: true, short: 'Door size' }),
    c('The garage', 'job', 'Door job', ['New door', 'Repair door', 'Opener only', 'No door work'], { short: 'Door work' }),
    c('The garage', 'ins', 'Insulated?', YN, { ns: true, short: 'Insulated' }),
    c('The floor', 'crack', 'Floor condition', ['Good', 'Some cracks', 'Badly cracked'], { ns: true, short: 'Floor' }),
    c('The floor', 'coat', 'Floor coating wanted?', YN, { short: 'Coating' }),
    c('The walls', 'store', 'Storage', ['Wall shelving', 'Ceiling racks', 'Both', 'None'], { short: 'Storage' }),
    LVL('The walls'),
  ],
};

export const questionsFor = (type: string): Q[] => [...(QUESTIONS[type] ?? []), ...COMMON];
export const optionsOf = (q: Q): string[] => (q.kind === 'chips' ? [...(q.options ?? []), ...(q.ns ? [NOT_SURE] : [])] : []);

export type Answers = Record<string, string>;

/** Keeps only keys and values the form could really have produced for this trade. */
export function cleanAnswers(type: string, raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const q of questionsFor(type)) {
    const v = String(r[q.k] ?? '').trim();
    if (!v) continue;
    if (q.kind === 'number') { const d = v.replace(/\D/g, '').slice(0, 7); if (d) out[q.k] = d; }
    else if (optionsOf(q).includes(v)) out[q.k] = v;
  }
  return out;
}

/** "Ready for bids" percentage and what is still missing. */
export function readiness(type: string, answers: Answers, photos: number, items: number, size: string) {
  const qs = questionsFor(type);
  const done = qs.filter((q) => answers[q.k]).length;
  const pct = qs.length ? Math.round((done / qs.length) * 100) : 0;
  const required = [
    { label: 'At least one item picked', ok: items > 0 },
    { label: 'Size', ok: (parseInt(size.replace(/\D/g, ''), 10) || 0) > 0 },
    { label: 'Start timing', ok: !!answers.when },
  ];
  const missing = qs.filter((q) => !answers[q.k]);
  return { pct, done, total: qs.length, required, missing, photos, missingRequired: required.filter((r) => !r.ok) };
}

/** Rows for the bidder view, in question order. Not-sure answers are flagged. */
export function answerRows(type: string, answers: unknown): { label: string; value: string; unsure: boolean }[] {
  const a = cleanAnswers(type, answers);
  return questionsFor(type).filter((q) => a[q.k]).map((q) => ({ label: q.short || q.label, value: q.kind === 'number' ? Number(a[q.k]).toLocaleString('en-US') : a[q.k], unsure: a[q.k] === NOT_SURE }));
}
export const detailPercent = (type: string, answers: unknown) => {
  const qs = questionsFor(type);
  const a = cleanAnswers(type, answers);
  return qs.length ? Math.round((qs.filter((q) => a[q.k]).length / qs.length) * 100) : 0;
};
