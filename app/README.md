# Digital Chant Stand

A local reader prototype for the public AGES GOA Dedes library.

## Run

From this folder:

```sh
/Users/mmonos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build-catalog.js
/Users/mmonos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

Then open `http://localhost:4173`.

## Source Data

The initial catalog is generated from:

`source/alwb-library-en-us-goadedes/alwb.library_en_US_goadedes`

The parser indexes display-friendly `.ares` assignments ending in `.text`, `.title`, `.rubric`, `.mode`, `.melody`, `.incipit`, `.name`, and `.greekname`.

## Editable Service Iterations

The reader keeps the DCS source text unchanged and stores parish-specific service iterations as replacement overlays in the browser.

- Select a service document from the DCS source library.
- Use **Replace** beside an individual hymn, rubric, mode, or title.
- Save the current set of replacements as a named iteration.
- Reopen, copy, delete, or export saved iterations for that same service.

Saved iterations live in browser local storage under `dcsServiceEditions`. Export produces a JSON copy of the active iteration.

Parish-wide English replacements are also saved immediately in browser local storage under `dcsReplacementDatabase`. These replacements are keyed first by the internal DCS English source key, such as `liturgical.verses_en_US_saas|psMA.beginning.v1.text`, and fall back to the imported row key when no DCS key is available. This lets a parish version of the same hymn or verse reapply consistently when that source key appears again.

## Supabase Replacement Database

Chantland can sync parish-wide replacements to Supabase. The browser still keeps local storage as a fallback, but when Supabase is configured and the table exists, replacements are loaded from and saved to the `parish_replacements` table.

Run this SQL in the Supabase SQL editor:

`app/supabase/schema.sql`

The current frontend config lives in:

`app/src/supabase-config.js`

Important: the included row-level-security policies allow public anonymous read/write/delete so the no-login prototype can work from GitHub Pages. Before inviting broader use, add authentication and restrict writes to approved editors.
