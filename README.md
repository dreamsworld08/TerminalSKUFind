# THE TERMINAL — SKU Ledger

A small static SKU lookup web app used to search The Terminal's furniture catalog by SKU or model number and show USD prices converted to INR at a configurable rate. The repository includes two static pages:

- `index.html` — customer/staff-facing SKU search and ledger view
- `admin.html` — a UI-only admin panel for adding SKUs, assigning pending items, updating the USD→INR rate, and viewing simple analytics

Both pages use a Supabase project (client-side) for storage and analytics.

## Stack

- Language: Plain HTML with embedded JavaScript and CSS
- Runtime: Static site (browser)
- Libraries: @supabase/supabase-js (CDN), Google Fonts

## Quick start (local)

1. Serve the repo as a static site from the project root, for example:

   python -m http.server 8000

   or

   npx serve .

2. Open the app in your browser:

   - http://localhost:8000/index.html  (lookup UI)
   - http://localhost:8000/admin.html  (admin UI)

Note: the pages expect a Supabase project configured at the URL and anon key embedded in the HTML files. If you want to run using your own Supabase instance, update the SUPABASE_URL and SUPABASE_ANON_KEY constants in both `index.html` and `admin.html`.

## Supabase schema (example)

Create tables/views used by the app. Run these in your Supabase SQL editor (adapt types as needed):

```sql
-- Core ledger
CREATE TABLE items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL,
  description text NOT NULL,
  usd numeric
);

-- Items that were imported without SKU (admin assigns SKU later)
CREATE TABLE pending_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  description text NOT NULL,
  usd numeric
);

-- Key/value settings (usd_inr_rate stored as JSON)
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb
);

-- Search analytics log (written from client as fire-and-forget)
CREATE TABLE search_log (
  id bigserial PRIMARY KEY,
  sku text,
  created_at timestamptz DEFAULT now()
);

-- Simple aggregated view used by the admin UI
CREATE VIEW search_counts AS
  SELECT sku, COUNT(*) AS search_count
  FROM search_log
  GROUP BY sku
  ORDER BY search_count DESC;
```

Insert an initial rate example:

```sql
INSERT INTO settings (key, value) VALUES ('usd_inr_rate', '{"rate": 95.40, "date": "01 Aug 2026"}');
```

## Security notes

- The app includes the Supabase anon key and an admin passcode directly in client HTML. The anon key allows unauthenticated access to the Supabase API according to the project's Row Level Security (RLS) rules — review and tighten RLS policies before exposing this in production.
- The `admin.html` passcode is a UI-only gate and provides no real security. For production use, move admin actions to a server or require authenticated users with appropriate RLS policies.

## Suggestions / next steps

- Add a small README (this file) — done.
- Add `supabase_setup.sql` to the repo (I can create it if you want).
- Consider removing embedded secrets/passcode and implementing server-side protections or proper RLS rules in Supabase.
- Add a GitHub Pages/Netlify deployment config if you want hosted static pages.

## License

Add a license file (e.g., MIT) if you plan to make this public.
