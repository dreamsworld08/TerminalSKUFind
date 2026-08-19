-- THE TERMINAL — image scan (visual embedding)
-- Run once in the Supabase SQL Editor. Additive: one nullable column.
--
-- Stores a DINOv2-small feature vector (384 numbers) per photo. Unlike
-- image_phash, which only recognises a re-photograph of the same image,
-- this lets "Scan a photo" recognise the same product from a different
-- angle, background, or lighting — the two are used together, see
-- visual-embed.js and phash.js.
--
-- Column type is unchanged from length to length, so no migration is
-- needed if you're upgrading from the earlier MobileNetV2-based version —
-- just re-run the "Compute visual recognition for existing photos" backfill
-- in Admin to replace the stale 1280-number vectors with fresh 384-number
-- ones (admin.html detects the length mismatch and treats them as missing).

alter table items add column if not exists image_embedding real[];
