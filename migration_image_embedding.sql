-- THE TERMINAL — image scan (visual embedding)
-- Run once in the Supabase SQL Editor. Additive: one nullable column.
--
-- Stores a MobileNetV2 feature vector (1280 numbers) per photo. Unlike
-- image_phash, which only recognises a re-photograph of the same image,
-- this lets "Scan a photo" recognise the same product from a different
-- angle, background, or lighting — the two are used together, see
-- mobilenet-embed.js and phash.js.

alter table items add column if not exists image_embedding real[];
