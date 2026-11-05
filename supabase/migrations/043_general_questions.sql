-- General questions: a homeowner can ask a contractor something without a posted project.
alter table bid_invites alter column listing_id drop not null;
create unique index if not exists bid_invites_general_uq on bid_invites (homeowner_id, company_id) where listing_id is null;
