-- Where each shoppable item sits in each AI picture, found once and kept: {"0":[{"n":1,"x":0.5,"y":0.4}], "1":[...]}
alter table public.design_ideas add column if not exists spots jsonb;
