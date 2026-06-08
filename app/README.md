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
