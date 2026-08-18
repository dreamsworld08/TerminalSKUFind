-- THE TERMINAL — image scan (perceptual hash)
-- Run once in the Supabase SQL Editor. Additive: one nullable column.

alter table items add column if not exists image_phash text;
