# THE TERMINAL — SKU Ledger

Internal price-lookup tool for The Terminal (luxury designer furniture, hybrid offline+online). Staff/customers search a SKU and get the price converted to INR. The admin panel also supports adding new SKUs, backfilling structured size/material data, and finding catalog items that fit a client's room or target furniture size.

- `index.html` — public/staff-facing SKU search and ledger view
- `admin.html` — passcode-gated admin panel: SKU management, USD→INR rate, search analytics, dimension/material data tools, and the Furniture Finder

Both pages are static, no build step, and talk directly to a Supabase project (client-side) for storage and analytics.

## Stack

- Language: Plain HTML with embedded JavaScript and CSS
- Runtime: Static site (browser) — deployed via GitHub Pages
- Backend: Supabase (Postgres + auto REST API)
- Libraries: @supabase/supabase-js, PapaParse (both via CDN)

## Quick start (local)

1. Serve the repo as a static site from the project root, for example:

   python -m http.server 8000

   or

   npx serve .

2. Open the app in your browser:

   - http://localhost:8000/index.html  (lookup UI)
   - http://localhost:8000/admin.html  (admin UI, passcode-gated)

Note: the pages expect a Supabase project configured at the URL and anon key embedded in the HTML files (`SUPABASE_URL` / `SUPABASE_ANON_KEY`). To run against your own Supabase instance, update those constants in both `index.html` and `admin.html`, then run `migration_furniture_finder.sql` once in the Supabase SQL Editor.

## Database schema

A single flat `items` table — there is no products/variants split. Each row is one SKU variant.

- `id, sku, description, usd, created_at` — the original columns. **`sku` is intentionally NOT unique**: multiple rows can share a SKU for different colors/configs (same physical supplier tag). `description` is free text and is the ultimate source of truth (e.g. `"3 Seat+L.A.F. Chaise, Leather, L.Blue, 2760x1760x820mm"`).
- `length_mm, width_mm, height_mm, diameter_mm` — structured footprint, canonical unit mm. `diameter_mm` is set (and mirrored into length/width) for round items.
- `dimension_sets` (jsonb) — for multi-part/combo items, the individual `{length_mm,width_mm,height_mm}` per part. `length_mm`/`width_mm`/`height_mm` on the row itself hold the envelope max across parts, not a true combined footprint — the UI always flags these for manual verification rather than treating them as reliable.
- `dimension_parse_status` — `parsed` | `round` | `multi_part` | `ambiguous` | `no_dims`. `dimension_raw` keeps the matched substring for audit.
- `material, color, texture` — structured, split out of `description`. `material_review_status` (`pending`/`reviewed`) tracks whether a human has confirmed the split, since the source text mixes material and finish/pattern codes together (e.g. `"Fabric ANTHOLOGY-1/iron powder coated TK23"`) and only a human can judge supplier shorthand reliably.

Other tables: `pending_items` (description + price, awaiting SKU assignment), `settings` (key/value, currently just `usd_inr_rate` as JSON), `search_log` (one row per successful SKU search from `index.html`), and `search_counts` (a view aggregating `search_log`, powers the admin analytics).

The full migration (additive, nullable columns only) is in `migration_furniture_finder.sql`.

## admin.html features

- **Passcode gate**: hardcoded client-side passcode. **UI-only lock, not real auth** — anyone with the Supabase URL + anon key could bypass it via direct API calls. Fine for an internal tool; upgrade to Supabase Auth if that becomes a real concern.
- **Add a new SKU**: SKU, description, price, plus optional structured Length/Width/Height (with a mm/in/ft unit selector), diameter, material, color, and texture.
- **Needs a SKU**: assign a SKU to a pending item.
- **Full ledger**: browse/delete existing items.
- **Data tools — dimensions & materials**:
  - *Parse dimensions from descriptions*: regex-backfills `length_mm`/`width_mm`/`height_mm`/`diameter_mm`/`dimension_sets` from each item's `description`. Mechanical and safe to re-run.
  - *Export material/color/texture review CSV*: downloads a CSV with best-guess material/color/texture per item (parsed from `description`), flagging low-confidence rows as `REVIEW`. Nothing is written to the database at this step.
  - *Import corrected CSV*: re-upload the reviewed CSV to write `material`/`color`/`texture` back to the DB, matched by row `id` (never by `sku`, since SKU isn't unique).
- **Furniture Finder**: given a client's room size or a target furniture size — entered in mm, inches, or feet (including `8'6"` notation) — lists catalog items that fit, with material/texture filters (e.g. exclude leather). Room mode checks footprint against (room size − a configurable clearance margin); furniture mode matches within a configurable tolerance %. Both allow the piece to be rotated 90°. Multi-part/combo items are always shown with a "verify manually" flag rather than silently included or excluded.
- **Analytics**: total searches and distinct SKUs searched, plus a bar chart of the most-searched SKUs (from `search_counts`), shown directly on the dashboard.
- **Top products**: the most-searched SKUs resolved back to catalog items, with product name, SKU and INR price.
- **Local weather**: current temperature and conditions for wherever the admin is. Location comes from the browser's geolocation prompt, falling back to IP lookup, then to Dhaka. This is the only part of the app that calls third-party services — `open-meteo.com` (weather, no API key), `ipwho.is` (IP location) and `bigdatacloud.net` (reverse geocoding). All are called from the browser; if any is blocked the card degrades to "Weather unavailable" and nothing else is affected.

## AI suggestions (optional)

The Furniture Finder can hand its shortlist to a language model, which proposes a
coherent scheme and explains each choice. It is optional — the scoring engine works
on its own, and the panel degrades to a setup hint if the function isn't deployed.

**The OpenRouter key must never go in `admin.html`.** This repo and the GitHub Pages
site are public, so a key in the page is a key anyone can read and spend. It lives in
a Supabase Edge Function instead:

1. Supabase dashboard → **Edge Functions** → **Deploy a new function**, name it
   `ai-suggest`, and paste in `supabase/functions/ai-suggest/index.ts`.
2. Supabase dashboard → **Project Settings → Edge Functions → Secrets** → add
   `OPENROUTER_API_KEY` with your key. Optionally add `OPENROUTER_MODEL` to change
   models.

With the CLI instead: `supabase secrets set OPENROUTER_API_KEY=...` then
`supabase functions deploy ai-suggest`.

Notes:
- Only the shortlist the local engine already ranked is sent (max 24 items), so the
  model can only choose between pieces that physically fit, and cannot invent stock.
- Each candidate carries a row `ref`, not just a SKU — one SKU covers several
  variants (the same sofa in leather and in fabric), and they are not interchangeable.
  Replies are resolved by `ref` so the card shows the exact variant chosen.
- Default model is `google/gemini-3.5-flash-lite` (~₹0.12 a search). This account
  restricts providers to nvidia/mistral/tencent/cloudflare/perplexity/google-ai-studio,
  so Anthropic and OpenAI models return `404 no allowed providers`.
- The function is callable by anyone holding the anon key (which is in the page).
  Set a spend limit on the OpenRouter key to bound the worst case.

## Data history / key decisions

- Catalog was built from ~13 supplier PDFs (price lists, quotations, a proforma invoice). OCR was tried and abandoned as unreliable; extraction was done by reading each PDF directly.
- Dedup rule: a row is only treated as an exact duplicate (dropped) if SKU **and** price **and** description all match. Same SKU with a different price/combo/color is kept as a separate variant — a deliberate decision so real product variants are never silently dropped.
- 35 items that arrived with no SKU were assigned SKUs using the scheme `[2-letter category code][2 random letters][26][P]` (e.g. `LCHM26P` = Leisure Chair, random pair, 2026, 1 piece). Category codes: LC=Leisure Chair, LS=Leisure Chair+Stool, SF=Sofa, ST=Stool, TT=Tea Table, CH=Chair/Dining Chair, BD=Bed, NS=Night Stand, OT=Ottoman, CB=Cabinet, SC=Side Cabinet, SD=Side Table, CT=Console/Entryway Table, CC=Combo Coffee Table.
- Current catalog size: 185 rows in `items`.

## Known gaps / possible next steps

- Exchange rate is manual, not a live feed.
- No real authentication on admin.html (see caveat above).
- No product images.
- `length_mm`/`width_mm`/`height_mm`/`material`/`color`/`texture` are only populated once the Data Tools backfill + CSV review has been run against the live catalog — until then the Furniture Finder has nothing to search over.
- Multi-part/combo item dimensions are an envelope max, not a true combined footprint — always double-check these against `dimension_sets` before recommending to a client.
- Mobile responsiveness and predictive search (4+ chars) are already implemented in index.html.
- Logo is embedded as a base64 PNG (white background removed) in both HTML files; also used as favicon.
- Consider tightening RLS policies and moving admin actions server-side before treating this as more than an internal tool.

## Reference files

- `migration_furniture_finder.sql` — additive schema migration (dimensions + material/color/texture columns), run once
- `THE_TERMINAL_SKU_Tag_Sheet.pdf` — printable checklist for physically tagging products

## License

Add a license file (e.g., MIT) if you plan to make this public.
