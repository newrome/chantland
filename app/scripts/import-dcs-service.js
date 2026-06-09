const fs = require("fs");
const path = require("path");

const url = process.argv[2];
const slug = process.argv[3] || slugFromUrl(url);

if (!url) {
  console.error("Usage: node scripts/import-dcs-service.js <dcs-url> [slug]");
  process.exit(1);
}

const outDir = path.resolve(__dirname, "../data/services");
const outFile = path.join(outDir, `${slug}.json`);
const indexFile = path.join(outDir, "index.json");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      "accept": "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch DCS page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = cleanText(titleMatch?.[1] || slug);
  const rows = extractRows(html)
    .map((row, index) => ({
      key: `${slug}.row${String(index + 1).padStart(3, "0")}`,
      kind: classifyRow(row),
      dcsClasses: row.classes,
      dcsKeys: row.keys,
      greek: row.greek,
      value: row.english,
    }))
    .filter((row) => row.greek || row.value);

  const service = {
    id: `service:${slug}`,
    slug,
    title: titleFromRows(rows, pageTitle),
    sourceUrl: url,
    importedAt: new Date().toISOString(),
    entries: rows,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(service, null, 2)}\n`);
  updateIndex(service);
  console.log(`Imported ${rows.length} rows to ${outFile}`);
}

function extractRows(html) {
  const rows = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(html))) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<td\b[^>]*class=["'][^"']*(leftCell|rightCell)[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi)];
    const greek = cleanText(cells.find((cell) => cell[1] === "leftCell")?.[2] || "");
    const english = cleanText(cells.find((cell) => cell[1] === "rightCell")?.[2] || "");
    const classes = [...rowHtml.matchAll(/class=["']([^"']+)["']/gi)]
      .flatMap((match) => match[1].split(/\s+/))
      .filter(Boolean);
    const keys = [...rowHtml.matchAll(/data-key=["']([^"']+)["']/gi)].map((match) => match[1]);
    if (greek || english) rows.push({ greek, english, classes: [...new Set(classes)], keys });
  }
  return rows;
}

function cleanText(value) {
  return decodeEntities(String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim());
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function classifyRow(row) {
  const english = row.english || "";
  const greek = row.greek || "";
  if (row.classes.includes("hymn")) return "hymn";
  if (row.classes.includes("greekmelody")) return "greekmelody";
  if (row.classes.includes("verse") || row.keys.some((key) => /\|misc\.vVerse\d+/.test(key))) return "verse";
  if (/^(MATINS|PRIEST|READER|CHOIR|DEACON|BOOKS - SOURCES)$/i.test(english)) return "title";
  if (/^(Mode|Grave Mode|First Mode|Second Mode|Third Mode|Fourth Mode|Plagal)/i.test(english)) return "mode";
  if (english.length < 55 && greek.length < 55 && !/[.!?·;]$/.test(english)) return "rubric";
  return "text";
}

function titleFromRows(rows, fallback) {
  const service = rows.find((row) => row.value === "MATINS");
  const dateSource = rows.find((row) => /Menaion - /.test(row.value));
  if (service && dateSource) return `${service.value} · ${dateSource.value.replace(/^Menaion - /, "")}`;
  return fallback;
}

function slugFromUrl(input) {
  if (!input) return "dcs-service";
  const match = input.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/([^/]+)\/index\.html$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}-${match[4]}-${match[5]}`;
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "dcs-service";
}

function updateIndex(service) {
  const index = fs.existsSync(indexFile)
    ? JSON.parse(fs.readFileSync(indexFile, "utf8"))
    : { services: [] };
  const item = {
    id: service.id,
    slug: service.slug,
    title: service.title,
    path: `data/services/${service.slug}.json`,
    sourceUrl: service.sourceUrl,
  };
  const existing = index.services.findIndex((entry) => entry.id === service.id);
  if (existing >= 0) index.services[existing] = item;
  else index.services.push(item);
  index.services.sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
}
