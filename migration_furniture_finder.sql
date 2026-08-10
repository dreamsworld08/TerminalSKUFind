-- THE TERMINAL — Furniture Finder migration
-- Additive only: new nullable columns on the existing `items` table.
-- Nothing is deleted or overwritten. Safe to re-run (IF NOT EXISTS guards).
-- Run once in the Supabase SQL Editor for project irbzgfmcmrvrylvugeee.

alter table items add column if not exists length_mm   numeric;
alter table items add column if not exists width_mm    numeric;
alter table items add column if not exists height_mm   numeric;
alter table items add column if not exists diameter_mm numeric;
alter table items add column if not exists dimension_sets jsonb;        -- multi-part/combo items: [{length_mm,width_mm,height_mm}, ...]
alter table items add column if not exists dimension_parse_status text; -- 'parsed' | 'round' | 'multi_part' | 'ambiguous' | 'no_dims'
alter table items add column if not exists dimension_raw text;          -- matched substring, for audit

alter table items add column if not exists material text;
alter table items add column if not exists color    text;
alter table items add column if not exists texture  text;
alter table items add column if not exists material_review_status text default 'pending'; -- 'pending' | 'reviewed'
