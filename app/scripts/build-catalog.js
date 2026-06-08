const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../../source/alwb-library-en-us-goadedes/alwb.library_en_US_goadedes");
const outFile = path.resolve(__dirname, "../data/catalog.json");

const files = walk(root).filter((file) => file.endsWith(".ares"));
const collections = new Map();

for (const file of files) {
  const relative = path.relative(root, file);
  const parts = relative.split(path.sep);
  const collection = parts[0] === "Books-Collections" ? parts[1] : parts[0];
  const entries = parseAres(fs.readFileSync(file, "utf8"));

  if (!entries.length) continue;
  if (!collections.has(collection)) collections.set(collection, []);

  const id = relative.replaceAll(path.sep, "/");
  collections.get(collection).push({
    id,
    path: id,
    title: titleFrom(entries, file),
    entries,
  });
}

const catalog = {
  generatedAt: new Date().toISOString(),
  source: "AGES-Initiatives/alwb-library-en-us-goadedes",
  collections: [...collections.entries()]
    .map(([name, documents]) => ({
      name,
      documents: documents.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => preferredOrder(a.name) - preferredOrder(b.name) || a.name.localeCompare(b.name)),
};

fs.writeFileSync(outFile, `${JSON.stringify(catalog, null, 2)}\n`);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : fullPath;
  });
}

function parseAres(input) {
  const entries = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line || line.startsWith("//")) continue;

    const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if (!isDisplayKey(key)) continue;

    value = unquote(value);
    if (!value) continue;

    entries.push({
      key,
      kind: kindFor(key),
      value,
    });
  }
  return entries;
}

function stripComment(line) {
  let quoted = false;
  for (let i = 0; i < line.length - 1; i += 1) {
    if (line[i] === "\"" && line[i - 1] !== "\\") quoted = !quoted;
    if (!quoted && line[i] === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

function isDisplayKey(key) {
  return /\.(text|title|rubric|mode|melody|incipit|name|greekname)$/.test(key);
}

function kindFor(key) {
  const suffix = key.split(".").pop();
  if (suffix === "rubric") return "rubric";
  if (suffix === "mode") return "mode";
  if (suffix === "title") return "title";
  if (suffix === "melody" || suffix === "incipit" || suffix === "name" || suffix === "greekname") return "melody";
  return "text";
}

function unquote(value) {
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1).replace(/\\"/g, "\"").replace(/\\n/g, "\n");
  }
  return value;
}

function titleFrom(entries, file) {
  const title = entries.find((entry) => entry.kind === "title" && !entry.value.includes("_en_US_"));
  if (title) return title.value.replace(/\.$/, "");

  const firstText = entries.find((entry) => entry.kind === "text" && entry.value.length < 90);
  if (firstText) return firstText.value.replace(/\.$/, "");

  return path.basename(file, ".ares").replace(/_en_US_goadedes$/, "");
}

function preferredOrder(name) {
  const order = [
    "Daily",
    "Horologion",
    "Octoechos",
    "Menaion",
    "Triodion",
    "Pentecostarion",
    "Eothina",
    "Euchologion",
    "Hieratikon_PriestsHandbook",
    "Heirmologion",
    "Other",
    "Skeletons",
    "Constants",
    "Properties",
  ].indexOf(name);
  return order === -1 ? 999 : order;
}
