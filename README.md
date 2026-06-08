# Digital Chant Stand

A local web application inspired by the Digital Chant Stand, built from the public AGES GOA Dedes source library.

The app includes:

- DCS-source library browsing
- search across indexed chant text
- reader controls
- per-hymn replacement editing
- named saved service iterations
- exportable service-edition JSON

The deployable app lives in `app/`.

## Run Locally

```sh
cd app
/Users/mmonos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

Then open `http://localhost:4173`.

## Hosting

This is currently a static web app. Upload the contents of `app/` to any static host, including GitHub Pages, Hostinger, Netlify, Vercel, or Cloudflare Pages.

Saved service iterations currently use browser local storage. A shared multi-user version will need a backend database.
