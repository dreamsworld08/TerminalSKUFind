-- THE TERMINAL — product images
-- Run once in the Supabase SQL Editor.
-- Additive only: adds two nullable columns, one storage bucket, and the
-- policies that let the admin page upload and the public page read.

-- 1. Where the image lives, per VARIANT row (not per SKU).
--    A SKU can cover several different pieces - 2A06 is both a 1-seat chair
--    and a 4-seat corner sofa - so the image belongs to the row, not the SKU.
alter table items add column if not exists image_path text;
alter table items add column if not exists image_updated_at timestamptz;

-- 2. Public bucket for the photos.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- 3. Storage access.
--    Read is open because the public search page shows the photos.
--    Write is open to the anon key because that is what the admin page holds -
--    the same posture as the rest of this app. Tighten with Supabase Auth if
--    the admin panel ever leaves your own hands.
drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product images are writable" on storage.objects;
create policy "product images are writable"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

drop policy if exists "product images are replaceable" on storage.objects;
create policy "product images are replaceable"
  on storage.objects for update
  using (bucket_id = 'product-images');

drop policy if exists "product images are removable" on storage.objects;
create policy "product images are removable"
  on storage.objects for delete
  using (bucket_id = 'product-images');
