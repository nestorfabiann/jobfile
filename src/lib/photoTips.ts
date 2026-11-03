/** What to photograph, per trade. Shown on the post form as a guide, never required. */
export const PHOTO_TIPS: Record<string, string[]> = {
  'Kitchen remodel': ['Every wall, floor to ceiling', 'Cabinets and countertops up close', 'Sink, stove and appliance areas', 'Anything damaged or leaking'],
  Bathroom: ['The whole room from the doorway', 'Shower or tub and the walls around it', 'Vanity, toilet and floor', 'Water stains, cracks or mold'],
  Painting: ['Each room, from the corner', 'Walls with damage, cracks or stains', 'Trim, doors and ceilings', 'Exterior: each side of the house'],
  Roofing: ['The whole house from the street, each side', 'Close-ups of leaks, stains or missing shingles', 'Ceiling stains inside, and the attic if you can', 'Gutters and vents'],
  Flooring: ['The whole room from the doorway', 'Close-up of the current floor', 'Transitions between rooms', 'Damage, gaps or soft spots'],
  Landscaping: ['The whole yard from two corners', 'Fence lines and gates', 'Trees, beds or areas to change', 'Drainage problems or bare spots'],
  Plumbing: ['The fixture or area with the problem', 'The water heater, including its label', 'Visible pipes, shutoff valves and leaks', 'Water stains on walls or ceilings'],
  Electrical: ['The electrical panel, door open', 'The outlets, switches or fixtures to change', 'Rooms where you want new lights or outlets', 'Anything scorched, loose or flickering'],
  HVAC: ['The outdoor unit and its label', 'The indoor unit or furnace and its label', 'Vents and the thermostat', 'Where ducts run, if you can see them'],
  'Windows and doors': ['Each window or door, inside and outside', 'Rot, gaps, drafts or broken seals', 'The wall around the opening', 'Any labels or sizes you can find'],
  'Siding and exterior': ['Each side of the house from a distance', 'Close-ups of damaged or rotted spots', 'Soffit, fascia and trim', 'Gutters and downspouts'],
  Fencing: ['The whole fence line from each end', 'Gates and posts up close', 'Damaged or leaning sections', 'Slopes, trees or obstacles along the line'],
  'Decks and patios': ['The whole space from a few steps back', 'Boards, posts and railings up close', 'Where the deck meets the house', 'Rot, rust or loose pieces'],
  'Concrete and driveways': ['The whole area from one end', 'Cracks and sunken spots up close', 'Edges, drainage and nearby trees', 'Where new concrete would go'],
  'Drywall and carpentry': ['Each damaged wall or ceiling, wide and close', 'Trim, doors or built-ins to change', 'Water stains or cracks', 'A tape measure in frame if you can'],
  Garage: ['The whole garage from the door', 'The garage door, inside and outside', 'The opener and its label', 'The floor, and walls you want shelving on'],
};
export const tipsFor = (type: string) => PHOTO_TIPS[type] ?? ['The whole space from a few steps back', 'Close-ups of problem areas', 'Anything damaged, stained or worn'];
