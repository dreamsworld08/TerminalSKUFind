---
name: terminal-sku-ledger
description: Project context for The Terminal SKU Ledger — a static SKU price-lookup tool (index.html + admin.html) backed by Supabase, with a Furniture Finder for matching room/furniture sizes and material filters against the catalog. Use whenever working in this repo, or when the user asks about SKUs, dimensions, materials, the admin panel, the Supabase schema, the Furniture Finder, or search analytics for "The Terminal".
---

# The Terminal — SKU Ledger

## What this is
Internal price-lookup tool for The Terminal (luxury designer furniture, hybrid offline+online). Staff/customers search a SKU and get the price converted to INR. The admin panel also supports adding new SKUs, backfilling structured size/material data from free-text descriptions, and — as of the Furniture Finder feature — finding catalog items that fit a client's room or target furniture size, filtered by material/texture.

## Live URLs
- Public search: GitHub Pages, repo `dreamsworld08/TerminalSKUFind` → `index.html`
- Admin backend: same repo → `admin.html` (passcode-gated)

## Stack
- Frontend: two static HTML files, no build step, no framework. Vanilla JS.
- Backend/DB: Supabase (Postgres + auto REST API)
  - Project URL: `https://irbzgfmcmrvrylvugeee.supabase.co`
  - Client uses the **publishable/anon key** (safe in browser, protected by RLS) — hardcoded in both HTML files as `SUPABASE_ANON_KEY`. RLS is permissive: the anon key can insert/update/delete on `items`/`pending_items`/`settings`, not just read.
  - Libraries loaded via CDN: `@supabase/supabase-js`, `papaparse` (for the Data Tools CSV export/import round-trip).

## Database schema — a single flat `items` table (verified live, no products/variants split)

**Important**: an earlier planning doc described an aspirational v2 `products`/`variants` schema. That was never actually built — verified directly against the live REST API. The real schema is:

- `id, sku, description, usd, created_at` — original columns. **`sku` is intentionally NOT unique** — multiple rows share a SKU across color/config variants (same physical supplier tag). `description` is free text and the ultimate source of truth, e.g. `"3 Seat+L.A.F. Chaise, Leather, L.Blue, 2760x1760x820mm"`.
- `length_mm, width_mm, height_mm, diameter_mm` — structured footprint in mm (canonical unit). `diameter_mm` set (and mirrored into length/width) for round items.
- `dimension_sets` (jsonb) — per-part `{length_mm,width_mm,height_mm}` for multi-part/combo items. The row-level length/width/height for these is an **envelope max across parts, not a true combined footprint** — the UI always flags multi-part items for manual verification.
- `dimension_parse_status` (`parsed`|`round`|`multi_part`|`ambiguous`|`no_dims`) and `dimension_raw` (matched substring, for audit).
- `material, color, texture` — split out of `description`. `material_review_status` (`pending`/`reviewed`) tracks human review, since the source text mixes material and finish/pattern codes together (e.g. `"Fabric ANTHOLOGY-1/iron powder coated TK23"`) — only a human can reliably judge supplier shorthand, so this is never auto-finalized.
- `pending_items` — description + price for items with no SKU yet, awaiting manual assignment.
- `settings` — key/value store, currently just `usd_inr_rate` (`{"rate":95.40,"date":"..."}`).
- `search_log` — one row per successful exact-SKU search (sku, timestamp), logged from `index.html`.
- `search_counts` — SQL view aggregating `search_log` by SKU, powers the analytics dashboard in `admin.html`.

Migration file: `migration_furniture_finder.sql` (additive, nullable-only columns — safe to re-run).

## admin.html features
- Passcode gate: hardcoded `"081191"` client-side. **UI-only lock, not real auth** — fine for an internal tool; upgrade to Supabase Auth if that becomes a real concern.
- Add a single SKU, with optional structured Length/Width/Height (mm/in/ft unit selector), diameter, material, color, texture.
- Pending-item → SKU assignment.
- USD→INR rate editor (manual, no live feed yet).
- Full ledger with delete.
- **Data tools**: parse dimensions from descriptions (regex backfill, mechanical, safe to re-run); export a material/color/texture review CSV (best-guess suggestions, `REVIEW` flag on low-confidence rows, nothing written to DB yet); import the corrected CSV back (matched by row `id`, never `sku`).
- **Furniture Finder**: enter a room size or a target furniture size in mm/in/ft (including `8'6"` notation) and get matching catalog items. Room mode: item footprint must fit inside (room size − configurable clearance margin). Furniture mode: item L/W/H within a configurable tolerance % of target. Both allow the item to be rotated 90°. Filters: material (checkbox, uncheck to exclude e.g. Leather), texture (substring search). Multi-part items are always shown with a "verify manually" badge, never silently pass/fail.
- Analytics: total searches, distinct SKUs searched, ranked bar list of most-searched SKUs (from `search_counts`).

## Data history / key decisions
- Catalog built from ~13 supplier PDFs (price lists, quotations, a proforma invoice) — OCR was tried and abandoned as unreliable; extraction was done by reading each PDF directly.
- Dedup rule: a row is only treated as an exact duplicate (dropped) if SKU **and** price **and** description all match. Same SKU with a different price/combo/color is kept as a separate variant — deliberate, so real product variants are never silently dropped.
- 35 items that arrived with no SKU were assigned SKUs using the scheme `[2-letter category code][2 random letters][26][P]` (e.g. `LCHM26P` = Leisure Chair, random pair, 2026, 1 piece) — category codes: LC=Leisure Chair, LS=Leisure Chair+Stool, SF=Sofa, ST=Stool, TT=Tea Table, CH=Chair/Dining Chair, BD=Bed, NS=Night Stand, OT=Ottoman, CB=Cabinet, SC=Side Cabinet, SD=Side Table, CT=Console/Entryway Table, CC=Combo Coffee Table.
- Current catalog size: 185 rows in `items`.
- Furniture Finder rotation: matching a piece placed sideways is allowed by default in both room-fit and target-size matching, since that's standard practice when checking whether a piece fits a space.

## Known gaps / possible next steps
- Exchange rate is manual, not a live feed.
- No real authentication on admin.html (see caveat above).
- No product images uploaded yet.
- `length_mm`/`material`/`color`/`texture` are only populated once the Data Tools backfill + CSV review round-trip has actually been run against the live catalog — until then the Furniture Finder has nothing to search over.
- Multi-part/combo dimensions are an envelope max, not a true combined footprint — always cross-check `dimension_sets` before recommending one of these to a client.
- Mobile responsiveness and predictive search (4+ chars) already implemented in index.html.
- Logo is embedded as a base64 PNG (white background removed) in both HTML files; also used as favicon.

## Reference files delivered in this project
- `migration_furniture_finder.sql` — additive schema migration (dimensions + material/color/texture columns), run once in the Supabase SQL Editor
- `THE_TERMINAL_SKU_Tag_Sheet.pdf` — printable checklist for physically tagging products
