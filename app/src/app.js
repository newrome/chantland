import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_REPLACEMENTS_TABLE,
  SUPABASE_URL,
} from "./supabase-config.js";

const STORAGE_KEY = "dcsServiceEditions";
const REPLACEMENT_DB_KEY = "dcsReplacementDatabase";

const state = {
  catalog: null,
  editions: loadEditions(),
  replacementDatabase: loadReplacementDatabase(),
  supabaseReady: Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY),
  syncStatus: "Local",
  collection: null,
  documentId: null,
  activeEditionId: null,
  draft: null,
  editingKey: null,
  workspaceMode: localStorage.getItem("dcsWorkspaceMode") || "edit",
  filter: "all",
  query: "",
  fontSize: Number(localStorage.getItem("dcsFontSize") || 19),
};

const els = {
  search: document.querySelector("#searchInput"),
  collections: document.querySelector("#collectionList"),
  documents: document.querySelector("#documentList"),
  content: document.querySelector("#chantContent"),
  title: document.querySelector("#documentTitle"),
  meta: document.querySelector("#documentMeta"),
  editionNote: document.querySelector("#editionNote"),
  collectionLabel: document.querySelector("#collectionLabel"),
  filters: document.querySelectorAll("[data-filter]"),
  workspaceModes: document.querySelectorAll("[data-workspace-mode]"),
  serviceNav: document.querySelector("#serviceNav"),
  increaseFont: document.querySelector("#increaseFont"),
  decreaseFont: document.querySelector("#decreaseFont"),
  toggleTheme: document.querySelector("#toggleTheme"),
  editionSelect: document.querySelector("#editionSelect"),
  editionName: document.querySelector("#editionName"),
  replacementCount: document.querySelector("#replacementCount"),
  newEdition: document.querySelector("#newEdition"),
  copyEdition: document.querySelector("#copyEdition"),
  saveEdition: document.querySelector("#saveEdition"),
  deleteEdition: document.querySelector("#deleteEdition"),
  exportEdition: document.querySelector("#exportEdition"),
  editDialog: document.querySelector("#editDialog"),
  editKind: document.querySelector("#editKind"),
  editTitle: document.querySelector("#editTitle"),
  editSource: document.querySelector("#editSource"),
  sourceText: document.querySelector("#sourceText"),
  replacementText: document.querySelector("#replacementText"),
  restoreSource: document.querySelector("#restoreSource"),
  applyReplacement: document.querySelector("#applyReplacement"),
};

init();

async function init() {
  document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
  document.body.classList.toggle("dark", localStorage.getItem("dcsTheme") === "dark");

  await loadRemoteReplacementDatabase();
  state.catalog = { collections: [] };
  await loadImportedServices();
  selectFirstAvailableDocument();
  resetDraftForSelectedDocument();

  bindEvents();
  render();
  loadSourceCatalog();
}

async function loadSourceCatalog() {
  try {
    const response = await fetch("./data/catalog.json");
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const catalog = await response.json();
    const imported = state.catalog.collections.filter((collection) => collection.name === "Imported DCS Services");
    const existingNames = new Set(imported.map((collection) => collection.name));
    state.catalog.collections = [
      ...imported,
      ...catalog.collections.filter((collection) => !existingNames.has(collection.name)),
    ];
    render();
  } catch (error) {
    els.meta.textContent = "The imported service loaded, but the full source library could not be loaded.";
    console.error(error);
  }
}

function selectFirstAvailableDocument() {
  state.collection = state.catalog.collections[0]?.name || null;
  state.documentId = state.catalog.collections[0]?.documents[0]?.id || null;
}

function bindEvents() {
  els.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    const match = findFirstMatchingDocument();
    if (match) {
      state.collection = match.collection;
      state.documentId = match.document.id;
      loadBestEditionForDocument();
    }
    render();
  });

  els.filters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  });

  els.workspaceModes.forEach((button) => {
    button.addEventListener("click", () => {
      state.workspaceMode = button.dataset.workspaceMode;
      localStorage.setItem("dcsWorkspaceMode", state.workspaceMode);
      render();
    });
  });

  els.editionSelect.addEventListener("change", () => {
    if (els.editionSelect.value === "source") {
      resetDraftForSelectedDocument();
    } else {
      loadEdition(els.editionSelect.value);
    }
    render();
  });

  els.editionName.addEventListener("input", () => {
    state.draft.name = els.editionName.value;
  });

  els.newEdition.addEventListener("click", () => {
    resetDraftForSelectedDocument(`Custom ${selectedDocument(selectedCollection())?.title || "Service"}`);
    render();
  });

  els.copyEdition.addEventListener("click", () => {
    copyCurrentEdition();
    render();
  });

  els.saveEdition.addEventListener("click", () => {
    saveCurrentEdition();
    render();
  });

  els.deleteEdition.addEventListener("click", () => {
    deleteCurrentEdition();
    render();
  });

  els.exportEdition.addEventListener("click", exportCurrentEdition);
  els.increaseFont.addEventListener("click", () => setFontSize(state.fontSize + 1));
  els.decreaseFont.addEventListener("click", () => setFontSize(state.fontSize - 1));
  els.toggleTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("dcsTheme", document.body.classList.contains("dark") ? "dark" : "light");
  });

  els.restoreSource.addEventListener("click", () => {
    const entry = selectedDocument(selectedCollection())?.entries.find((item) => item.key === state.editingKey);
    if (entry) els.replacementText.value = entry.value;
  });

  els.applyReplacement.addEventListener("click", async () => {
    const entry = selectedDocument(selectedCollection())?.entries.find((item) => item.key === state.editingKey);
    if (!entry) return;
    const value = els.replacementText.value.trim();
    if (!value || value === entry.value) {
      delete state.draft.replacements[entry.key];
      await deleteReplacementDatabaseEntry(entry);
    } else {
      const replacement = createReplacement(entry, value);
      state.draft.replacements[entry.key] = replacement;
      await upsertReplacementDatabaseEntry(entry, replacement);
    }
    state.draft.updatedAt = new Date().toISOString();
    persistEditions();
    render();
  });
}

function setFontSize(size) {
  state.fontSize = Math.max(16, Math.min(27, size));
  localStorage.setItem("dcsFontSize", String(state.fontSize));
  document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
}

function render() {
  document.body.classList.toggle("sing-mode", state.workspaceMode === "sing");
  renderCollections();
  renderDocuments();
  renderEditionPanel();
  renderDocument();
  renderServiceNav();
  els.filters.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
  els.workspaceModes.forEach((button) => {
    button.classList.toggle("active", button.dataset.workspaceMode === state.workspaceMode);
  });
}

function renderCollections() {
  els.collections.replaceChildren(...state.catalog.collections.map((collection) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "collection-button";
    button.classList.toggle("active", collection.name === state.collection);
    button.innerHTML = `<strong>${escapeHtml(collection.name)}</strong><span>${collection.documents.length}</span>`;
    button.addEventListener("click", () => {
      state.collection = collection.name;
      state.documentId = filteredDocuments(collection)[0]?.id || collection.documents[0]?.id;
      loadBestEditionForDocument();
      render();
    });
    return button;
  }));
}

function renderDocuments() {
  const collection = selectedCollection();
  if (!collection) return;

  const docs = filteredDocuments(collection);
  els.documents.replaceChildren(...docs.slice(0, 80).map((doc) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doc-button";
    button.classList.toggle("active", doc.id === state.documentId);
    button.textContent = doc.title;
    button.title = doc.title;
    button.addEventListener("click", () => {
      state.documentId = doc.id;
      loadBestEditionForDocument();
      render();
    });
    return button;
  }));
}

function renderEditionPanel() {
  const versions = editionsForCurrentDocument();
  const selected = selectedDocument(selectedCollection());
  const changed = selected ? effectiveReplacementCount(selected) : 0;
  const options = [
    optionElement("source", "Source text"),
    ...versions.map((edition) => optionElement(edition.id, edition.name || edition.title)),
  ];

  els.editionSelect.replaceChildren(...options);
  els.editionSelect.value = state.activeEditionId || "source";
  els.editionName.value = state.draft?.name || "";
  els.replacementCount.textContent = `${changed} changed`;
}

function renderDocument() {
  const collection = selectedCollection();
  const selected = selectedDocument(collection);

  if (!collection || !selected) {
    els.title.textContent = "No matching text";
    els.meta.textContent = "";
    els.editionNote.textContent = "";
    els.collectionLabel.textContent = "Library";
    els.serviceNav.replaceChildren();
    els.content.innerHTML = `<p class="empty">Try a broader search.</p>`;
    return;
  }

  const changed = effectiveReplacementCount(selected);
  els.collectionLabel.textContent = collection.name;
  els.title.textContent = selected.title;
  els.meta.textContent = [
    `${selected.entries.length} entries`,
    `${changed} replacements`,
    state.syncStatus,
    selected.path,
  ].join(" · ");
  els.editionNote.textContent = activeEditionLabel(changed);

  const queryMatchesDocument = state.query && `${selected.title} ${selected.path}`.toLowerCase().includes(state.query.toLowerCase());
  const entries = selected.entries.filter((entry) => {
    const effective = effectiveEntry(entry);
    if (entry.kind === "greekmelody") return false;
    if (state.workspaceMode === "sing") return true;
    if (state.filter !== "all" && entry.kind !== state.filter) return false;
    if (!state.query || queryMatchesDocument) return true;
    return `${entry.key} ${effective.value}`.toLowerCase().includes(state.query.toLowerCase());
  });

  if (!entries.length) {
    els.content.innerHTML = `<p class="empty">No entries match the current filter.</p>`;
    return;
  }

  els.content.replaceChildren(...entries.map((entry) => {
    const effective = effectiveEntry(entry);
    const section = document.createElement("section");
    section.className = `entry entry-${entry.kind}${effective.changed ? " changed" : ""}`;
    section.id = entryId(entry);
    const greekMelody = greekMelodyReferenceFor(selected, entry);
    section.innerHTML = state.workspaceMode === "sing"
      ? singingEntryMarkup(entry, effective, greekMelody)
      : (entry.greek ? bilingualEntryMarkup(entry, effective, greekMelody) : singleEntryMarkup(entry, effective));
    section.querySelector(".replace-button")?.addEventListener("click", () => openEditor(entry));
    return section;
  }));
}

function renderServiceNav() {
  const selected = selectedDocument(selectedCollection());
  if (!selected || state.workspaceMode !== "sing") {
    els.serviceNav.replaceChildren();
    return;
  }

  const links = selected.entries
    .filter((entry) => entry.kind === "title" || entry.kind === "rubric")
    .filter((entry) => (entry.value || entry.greek).length > 2 && (entry.value || entry.greek).length < 70)
    .slice(0, 28)
    .map((entry) => {
      const link = document.createElement("a");
      link.href = `#${entryId(entry)}`;
      link.textContent = entry.value || entry.greek;
      return link;
    });

  els.serviceNav.replaceChildren(...links);
}

function selectedCollection() {
  return state.catalog.collections.find((collection) => collection.name === state.collection);
}

function selectedDocument(collection) {
  return collection?.documents.find((doc) => doc.id === state.documentId)
    || filteredDocuments(collection)[0]
    || collection?.documents[0];
}

function filteredDocuments(collection) {
  if (!state.query) return collection?.documents || [];
  const query = state.query.toLowerCase();
  return (collection?.documents || []).filter((doc) => {
    return doc.title.toLowerCase().includes(query)
      || doc.path.toLowerCase().includes(query)
      || doc.entries.some((entry) => `${entry.key} ${entry.value}`.toLowerCase().includes(query));
  });
}

function findFirstMatchingDocument() {
  if (!state.query) return null;
  for (const collection of state.catalog.collections) {
    const doc = filteredDocuments(collection)[0];
    if (doc) return { collection: collection.name, document: doc };
  }
  return null;
}

function effectiveEntry(entry) {
  const replacement = state.draft?.replacements?.[entry.key] || databaseReplacementFor(entry);
  if (!replacement) return { ...entry, changed: false, replacement: null };
  return { ...entry, value: replacement.value, changed: true, replacement };
}

function greekMelodyReferenceFor(doc, entry) {
  if (entry.kind !== "mode") return "";
  const index = doc.entries.findIndex((item) => item.key === entry.key);
  const next = doc.entries[index + 1];
  if (next?.kind !== "greekmelody" || !next.value) return "";
  return next.value;
}

function activeEditionLabel(changed) {
  if (!changed) return "Source text";
  return `${state.draft?.name || "Parish Version"} · Parish Version`;
}

function effectiveReplacementCount(doc) {
  return doc.entries.filter((entry) => effectiveEntry(entry).changed).length;
}

function createReplacement(entry, value) {
  const now = new Date().toISOString();
  return {
    key: entry.key,
    sourceKeys: replacementLookupKeys(entry),
    kind: entry.kind,
    source: entry.value,
    value,
    note: "Parish Version",
    updatedAt: now,
  };
}

function databaseReplacementFor(entry) {
  return replacementLookupKeys(entry)
    .map((key) => state.replacementDatabase[key])
    .find(Boolean) || null;
}

async function upsertReplacementDatabaseEntry(entry, replacement) {
  for (const key of replacementLookupKeys(entry)) {
    state.replacementDatabase[key] = {
      ...replacement,
      databaseKey: key,
    };
  }
  persistReplacementDatabase();
  await syncReplacementToSupabase(entry, replacement);
}

async function deleteReplacementDatabaseEntry(entry) {
  for (const key of replacementLookupKeys(entry)) {
    delete state.replacementDatabase[key];
  }
  persistReplacementDatabase();
  await deleteReplacementFromSupabase(entry);
}

function replacementLookupKeys(entry) {
  const dcsKeys = (entry.dcsKeys || [])
    .filter((key) => /_en_/.test(key))
    .filter((key) => !key.includes("properties_"));
  return dcsKeys.length ? dcsKeys : [entry.key];
}

async function loadImportedServices() {
  try {
    const response = await fetch("./data/services/index.json");
    if (!response.ok) return;
    const index = await response.json();
    const services = await Promise.all((index.services || []).map(async (item) => {
      const serviceResponse = await fetch(`./data/services/${item.slug}.json`);
      if (!serviceResponse.ok) return null;
      const service = await serviceResponse.json();
      return {
        id: service.id,
        title: service.title,
        path: item.sourceUrl,
        entries: service.entries,
      };
    }));
    const documents = services.filter(Boolean);
    if (documents.length) {
      state.catalog.collections.unshift({
        name: "Imported DCS Services",
        documents,
      });
    }
  } catch {
    // Imported services are optional; the source library should still load.
  }
}

function openEditor(entry) {
  const replacement = effectiveEntry(entry).replacement;
  state.editingKey = entry.key;
  els.editKind.textContent = entry.kind;
  els.editTitle.textContent = labelFor(entry);
  els.editSource.textContent = replacementLookupKeys(entry).join(" · ");
  els.sourceText.value = entry.greek ? `${entry.greek}\n\n${entry.value}` : entry.value;
  els.replacementText.value = replacement?.value || entry.value;
  els.editDialog.showModal();
  els.replacementText.focus();
}

function resetDraftForSelectedDocument(name = "") {
  const doc = selectedDocument(selectedCollection());
  state.activeEditionId = null;
  state.draft = {
    id: createId(),
    documentId: doc?.id || state.documentId,
    collection: state.collection,
    title: doc?.title || "Untitled service",
    name,
    replacements: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function loadBestEditionForDocument() {
  const latest = editionsForCurrentDocument()[0];
  if (latest) {
    loadEdition(latest.id);
  } else {
    resetDraftForSelectedDocument();
  }
}

function loadEdition(id) {
  const edition = state.editions.find((item) => item.id === id);
  if (!edition) {
    resetDraftForSelectedDocument();
    return;
  }

  state.activeEditionId = edition.id;
  state.draft = structuredClone(edition);
}

function saveCurrentEdition() {
  const doc = selectedDocument(selectedCollection());
  state.draft.documentId = doc.id;
  state.draft.collection = state.collection;
  state.draft.title = doc.title;
  state.draft.name = (els.editionName.value || state.draft.name || `${doc.title} Custom`).trim();
  for (const entry of doc.entries) {
    const replacement = databaseReplacementFor(entry);
    if (replacement && !state.draft.replacements[entry.key]) {
      state.draft.replacements[entry.key] = {
        ...replacement,
        key: entry.key,
      };
    }
  }
  state.draft.updatedAt = new Date().toISOString();

  const index = state.editions.findIndex((edition) => edition.id === state.draft.id);
  if (index >= 0) {
    state.editions[index] = structuredClone(state.draft);
  } else {
    state.editions.push(structuredClone(state.draft));
  }
  state.activeEditionId = state.draft.id;
  persistEditions();
}

function copyCurrentEdition() {
  const doc = selectedDocument(selectedCollection());
  state.activeEditionId = null;
  state.draft = {
    ...structuredClone(state.draft),
    id: createId(),
    documentId: doc.id,
    collection: state.collection,
    title: doc.title,
    name: `Copy of ${state.draft.name || doc.title}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function deleteCurrentEdition() {
  if (!state.activeEditionId) {
    resetDraftForSelectedDocument();
    return;
  }

  state.editions = state.editions.filter((edition) => edition.id !== state.activeEditionId);
  persistEditions();
  resetDraftForSelectedDocument();
}

function exportCurrentEdition() {
  saveCurrentEdition();
  const blob = new Blob([JSON.stringify(state.draft, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(state.draft.name || state.draft.title)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function editionsForCurrentDocument() {
  return state.editions
    .filter((edition) => edition.documentId === state.documentId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function persistEditions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.editions));
}

function persistReplacementDatabase() {
  localStorage.setItem(REPLACEMENT_DB_KEY, JSON.stringify(state.replacementDatabase));
}

function loadEditions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadReplacementDatabase() {
  try {
    return JSON.parse(localStorage.getItem(REPLACEMENT_DB_KEY) || "{}");
  } catch {
    return {};
  }
}

async function loadRemoteReplacementDatabase() {
  if (!state.supabaseReady) return;

  try {
    const response = await fetch(supabaseTableUrl("?select=*"), {
      headers: supabaseHeaders(),
    });
    if (!response.ok) throw new Error(`Supabase load failed: ${response.status}`);

    const rows = await response.json();
    for (const row of rows) {
      state.replacementDatabase[row.dcs_key] = {
        databaseKey: row.dcs_key,
        key: row.row_key,
        sourceKeys: row.source_keys || [row.dcs_key],
        kind: row.kind || "text",
        source: row.source_text || "",
        value: row.replacement_text || "",
        note: row.note || "Parish Version",
        updatedAt: row.updated_at,
      };
    }
    state.syncStatus = "Supabase synced";
    persistReplacementDatabase();
  } catch (error) {
    state.syncStatus = "Local changes only";
    console.warn(error);
  }
}

async function syncReplacementToSupabase(entry, replacement) {
  if (!state.supabaseReady) return;

  try {
    const rows = replacementLookupKeys(entry).map((key) => ({
      dcs_key: key,
      row_key: entry.key,
      kind: entry.kind,
      source_keys: replacementLookupKeys(entry),
      source_text: entry.value,
      replacement_text: replacement.value,
      note: "Parish Version",
      updated_at: new Date().toISOString(),
    }));
    const response = await fetch(supabaseTableUrl("?on_conflict=dcs_key"), {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error(`Supabase save failed: ${response.status}`);
    state.syncStatus = "Supabase synced";
  } catch (error) {
    state.syncStatus = "Local changes only";
    console.warn(error);
  }
}

async function deleteReplacementFromSupabase(entry) {
  if (!state.supabaseReady) return;

  try {
    for (const key of replacementLookupKeys(entry)) {
      const response = await fetch(supabaseTableUrl(`?dcs_key=eq.${encodeURIComponent(key)}`), {
        method: "DELETE",
        headers: {
          ...supabaseHeaders(),
          Prefer: "return=minimal",
        },
      });
      if (!response.ok) throw new Error(`Supabase delete failed: ${response.status}`);
    }
    state.syncStatus = "Supabase synced";
  } catch (error) {
    state.syncStatus = "Local changes only";
    console.warn(error);
  }
}

function supabaseTableUrl(query = "") {
  return `${SUPABASE_URL}/rest/v1/${SUPABASE_REPLACEMENTS_TABLE}${query}`;
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
  };
}

function optionElement(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function labelFor(entry) {
  if (entry.key.includes(".row")) return entry.key.split(".").pop().replace(/^row/, "Row ");
  const parts = entry.key.split(".");
  return parts.slice(-3).join(" / ");
}

function entryId(entry) {
  return `entry-${entry.key.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function singleEntryMarkup(entry, effective) {
  return `
    <div class="entry-topline">
      <p class="entry-key">${escapeHtml(labelFor(entry))}</p>
      <button class="replace-button" type="button">${effective.changed ? "Edit replacement" : "Replace"}</button>
    </div>
    ${effective.changed ? `<p class="replacement-note">Parish Version</p>` : ""}
    <p class="entry-text">${formatEntryValue(entry, effective.value)}</p>
  `;
}

function bilingualEntryMarkup(entry, effective, greekMelody = "") {
  return `
    <div class="entry-topline">
      <p class="entry-key">${escapeHtml(labelFor(entry))}</p>
      <button class="replace-button" type="button">${effective.changed ? "Edit English" : "Replace English"}</button>
    </div>
    ${effective.changed ? `<p class="replacement-note">Parish Version</p>` : ""}
    <div class="bilingual-row">
      <p class="entry-text greek-text">${formatEntryValue(entry, entry.greek)}</p>
      <p class="entry-text">${formatEntryValue(entry, effective.value)}${greekMelodyMarkup(greekMelody)}</p>
    </div>
  `;
}

function singingEntryMarkup(entry, effective, greekMelody = "") {
  if (entry.greek) {
    return `
      ${effective.changed ? `<p class="replacement-note singing-note">Parish Version</p>` : ""}
      <div class="bilingual-row">
        <p class="entry-text greek-text">${formatEntryValue(entry, entry.greek)}</p>
        <p class="entry-text">${formatEntryValue(entry, effective.value)}${greekMelodyMarkup(greekMelody)}</p>
      </div>
    `;
  }

  return `
    ${effective.changed ? `<p class="replacement-note singing-note">Parish Version</p>` : ""}
    <p class="entry-text">${formatEntryValue(entry, effective.value)}</p>
  `;
}

function greekMelodyMarkup(value) {
  if (!value) return "";
  return `<span class="greek-melody-reference">[${formatValue(value)}]</span>`;
}

function formatEntryValue(entry, value) {
  if (entry.kind === "mode" && (entry.dcsClasses || []).includes("melody")) {
    return formatModeAndMelody(value);
  }
  return formatValue(value);
}

function formatModeAndMelody(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  const match = text.match(/^(Mode\s+(?:pl\.\s+)?\d+\.|Mode\s+(?:First|Second|Third|Fourth|Grave|Plagal)[^.]*\.|Ἦχος\s+[^.]+\.)\s*(.*)$/i);
  if (!match) return `<span class="mode-label">${formatValue(text)}</span>`;

  return [
    `<span class="mode-label">${formatValue(match[1])}</span>`,
    match[2] ? ` <span class="melody-label">${formatValue(match[2])}</span>` : "",
  ].join("");
}

function formatValue(value) {
  const escaped = escapeHtml(value)
    .replace(/\s\*\s/g, "<br>")
    .replace(/…/g, "&hellip;");
  if (!state.query) return escaped;
  const pattern = new RegExp(`(${escapeRegExp(state.query)})`, "ig");
  return escaped.replace(pattern, "<mark>$1</mark>");
}

function createId() {
  return `edition-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "service-edition";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
