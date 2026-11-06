-- More rooms for design ideas (exterior, living room, bedroom, wall colors only). Run once after 052.
alter table public.design_ideas drop constraint if exists design_ideas_space_check;
alter table public.design_ideas add constraint design_ideas_space_check
  check (space in ('kitchen', 'bathroom', 'exterior', 'living', 'bedroom', 'colors'));
