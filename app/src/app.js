const STORAGE_KEY = "dcsServiceEditions";

const state = {
  catalog: null,
  editions: loadEditions(),
  collection: null,
  documentId: null,
  activeEditionId: null,
  draft: null,
  editingKey: null,
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
  collectionLabel: document.querySelector("#collectionLabel"),
  filters: document.querySelectorAll("[data-filter]"),
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

  const response = await fetch("./data/catalog.json");
  state.catalog = await response.json();
  state.collection = state.catalog.collections[0]?.name;
  state.documentId = state.catalog.collections[0]?.documents[0]?.id;
  resetDraftForSelectedDocument();

  bindEvents();
  render();
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

  els.applyReplacement.addEventListener("click", () => {
    const entry = selectedDocument(selectedCollection())?.entries.find((item) => item.key === state.editingKey);
    if (!entry) return;
    const value = els.replacementText.value.trim();
    if (!value || value === entry.value) {
      delete state.draft.replacements[entry.key];
    } else {
      state.draft.replacements[entry.key] = {
        key: entry.key,
        kind: entry.kind,
        source: entry.value,
        value,
        updatedAt: new Date().toISOString(),
      };
    }
    state.draft.updatedAt = new Date().toISOString();
    render();
  });
}

function setFontSize(size) {
  state.fontSize = Math.max(16, Math.min(27, size));
  localStorage.setItem("dcsFontSize", String(state.fontSize));
  document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
}

function render() {
  renderCollections();
  renderDocuments();
  renderEditionPanel();
  renderDocument();
  els.filters.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
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
  const options = [
    optionElement("source", "Source text"),
    ...versions.map((edition) => optionElement(edition.id, edition.name || edition.title)),
  ];

  els.editionSelect.replaceChildren(...options);
  els.editionSelect.value = state.activeEditionId || "source";
  els.editionName.value = state.draft?.name || "";
  els.replacementCount.textContent = `${Object.keys(state.draft?.replacements || {}).length} changed`;
}

function renderDocument() {
  const collection = selectedCollection();
  const selected = selectedDocument(collection);

  if (!collection || !selected) {
    els.title.textContent = "No matching text";
    els.meta.textContent = "";
    els.collectionLabel.textContent = "Library";
    els.content.innerHTML = `<p class="empty">Try a broader search.</p>`;
    return;
  }

  const replacements = state.draft?.replacements || {};
  const changed = Object.keys(replacements).length;
  els.collectionLabel.textContent = collection.name;
  els.title.textContent = selected.title;
  els.meta.textContent = [
    `${selected.entries.length} entries`,
    `${changed} replacements`,
    selected.path,
  ].join(" · ");

  const queryMatchesDocument = state.query && `${selected.title} ${selected.path}`.toLowerCase().includes(state.query.toLowerCase());
  const entries = selected.entries.filter((entry) => {
    const effective = effectiveEntry(entry);
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
    section.innerHTML = `
      <div class="entry-topline">
        <p class="entry-key">${escapeHtml(labelFor(entry))}</p>
        <button class="replace-button" type="button">${effective.changed ? "Edit replacement" : "Replace"}</button>
      </div>
      ${effective.changed ? `<p class="replacement-note">Custom version saved in this iteration</p>` : ""}
      <p class="entry-text">${formatValue(effective.value)}</p>
    `;
    section.querySelector(".replace-button").addEventListener("click", () => openEditor(entry));
    return section;
  }));
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
  const replacement = state.draft?.replacements?.[entry.key];
  if (!replacement) return { ...entry, changed: false };
  return { ...entry, value: replacement.value, changed: true };
}

function openEditor(entry) {
  const replacement = state.draft?.replacements?.[entry.key];
  state.editingKey = entry.key;
  els.editKind.textContent = entry.kind;
  els.editTitle.textContent = labelFor(entry);
  els.editSource.textContent = entry.key;
  els.sourceText.value = entry.value;
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

function loadEditions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function optionElement(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function labelFor(entry) {
  const parts = entry.key.split(".");
  return parts.slice(-3).join(" / ");
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
