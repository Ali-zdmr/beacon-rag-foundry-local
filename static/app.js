// ---- persisted settings -----------------------------------------------

const SETTINGS_KEY = "foundryqa.settings";

function loadSettings() {
  const defaults = { theme: "dark", lang: "tr", topK: 3, showSources: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (err) {
    return defaults;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    /* ignore - private browsing / storage disabled */
  }
}

let settings = loadSettings();

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// ---- element refs -------------------------------------------------------

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");

const log = document.getElementById("log");
const composer = document.getElementById("composer");
const question = document.getElementById("question");
const suggestionsEl = document.getElementById("suggestions");
const sidebarStatus = document.getElementById("sidebar-status");
const btnClearChat = document.getElementById("btn-clear-chat");

const docList = document.getElementById("doc-list");
const uploadForm = document.getElementById("upload-form");
const uploadInput = document.getElementById("upload-input");
const btnReindex = document.getElementById("btn-reindex");

const topkInput = document.getElementById("setting-topk");
const topkValue = document.getElementById("setting-topk-value");
const showSourcesInput = document.getElementById("setting-show-sources");
const themeSelect = document.getElementById("setting-theme");
const langSelect = document.getElementById("setting-lang");
const backendDetails = document.getElementById("backend-details");

// ---- navigation -----------------------------------------------------------

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("active"));
    views.forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    if (btn.dataset.view === "docs") loadDocuments();
    if (btn.dataset.view === "settings") loadStatus();
  });
});

// ---- chat -----------------------------------------------------------------

function addMessage(role, text, chunks) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);

  if (role === "assistant" && settings.showSources && chunks && chunks.length) {
    const wrap = document.createElement("div");
    wrap.className = "sources";
    const label = document.createElement("div");
    label.className = "sources-label";
    label.textContent = t(settings.lang, "chat.sourcesLabel");
    wrap.appendChild(label);
    chunks.forEach((c) => {
      const card = document.createElement("div");
      card.className = "source-card";
      const head = document.createElement("div");
      head.className = "source-head";
      head.innerHTML = `<span>${c.source}</span><span class="score">${c.score}</span>`;
      const body = document.createElement("div");
      body.textContent = c.text.length > 220 ? c.text.slice(0, 220) + "..." : c.text;
      card.appendChild(head);
      card.appendChild(body);
      wrap.appendChild(card);
    });
    div.appendChild(wrap);
  }

  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function ask(text) {
  addMessage("user", text);
  question.value = "";
  question.disabled = true;

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, top_k: settings.topK }),
    });
    const data = await res.json();
    if (!res.ok) {
      addMessage("error", data.error || t(settings.lang, "chat.noAnswer"));
    } else {
      addMessage("assistant", data.answer, data.chunks);
    }
  } catch (err) {
    addMessage("error", t(settings.lang, "chat.noServer"));
  } finally {
    question.disabled = false;
    question.focus();
  }
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = question.value.trim();
  if (value) ask(value);
});

btnClearChat.addEventListener("click", () => {
  log.innerHTML = "";
  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `<p data-i18n="chat.welcome"></p>`;
  log.appendChild(div);
  applyI18n(settings.lang);
});

const SUGGESTION_QUESTIONS = [
  "What is RAG?",
  "What is Foundry Local?",
  "Why does chunk overlap matter?",
  "Why use SQLite for a local knowledge base?",
];

function renderSuggestions() {
  suggestionsEl.innerHTML = "";
  SUGGESTION_QUESTIONS.forEach((q) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = q;
    chip.addEventListener("click", () => ask(q));
    suggestionsEl.appendChild(chip);
  });
}

// ---- documents --------------------------------------------------------

async function loadDocuments() {
  docList.innerHTML = "";
  try {
    const res = await fetch("/api/documents");
    const data = await res.json();
    if (!data.documents || !data.documents.length) {
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = t(settings.lang, "docs.empty");
      docList.appendChild(li);
      return;
    }
    data.documents.forEach((doc) => {
      const li = document.createElement("li");
      li.className = "doc-row";
      const info = document.createElement("div");
      info.className = "doc-info";
      info.innerHTML =
        `<div class="doc-title">${doc.title}</div>` +
        `<div class="doc-meta">${doc.filename} - ${doc.chunk_count} ${t(settings.lang, "docs.chunks")}</div>`;
      const del = document.createElement("button");
      del.className = "doc-delete";
      del.textContent = t(settings.lang, "docs.delete");
      del.addEventListener("click", () => deleteDocument(doc.filename));
      li.appendChild(info);
      li.appendChild(del);
      docList.appendChild(li);
    });
  } catch (err) {
    docList.innerHTML = `<li class="hint">${t(settings.lang, "chat.noServer")}</li>`;
  }
}

async function deleteDocument(filename) {
  await fetch(`/api/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
  loadDocuments();
  loadStatus();
}

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!uploadInput.files.length) return;
  const formData = new FormData();
  formData.append("file", uploadInput.files[0]);
  await fetch("/api/documents", { method: "POST", body: formData });
  uploadInput.value = "";
  loadDocuments();
  loadStatus();
});

btnReindex.addEventListener("click", async () => {
  await fetch("/api/reindex", { method: "POST" });
  loadDocuments();
  loadStatus();
});

// ---- settings -----------------------------------------------------------

function initSettingsUI() {
  topkInput.value = settings.topK;
  topkValue.textContent = settings.topK;
  showSourcesInput.checked = settings.showSources;
  themeSelect.value = settings.theme;
  langSelect.value = settings.lang;
}

topkInput.addEventListener("input", () => {
  settings.topK = parseInt(topkInput.value, 10);
  topkValue.textContent = settings.topK;
  saveSettings(settings);
});

showSourcesInput.addEventListener("change", () => {
  settings.showSources = showSourcesInput.checked;
  saveSettings(settings);
});

themeSelect.addEventListener("change", () => {
  settings.theme = themeSelect.value;
  applyTheme(settings.theme);
  saveSettings(settings);
});

langSelect.addEventListener("change", () => {
  settings.lang = langSelect.value;
  applyI18n(settings.lang);
  renderSuggestions();
  saveSettings(settings);
});

// ---- status ---------------------------------------------------------------

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    sidebarStatus.textContent = `${data.documents} docs - ${data.chunks} chunks`;
    backendDetails.innerHTML =
      `embeddings: <code>${data.embedding_backend}</code><br>` +
      `model: <code>${data.llm_backend}</code>`;
  } catch (err) {
    sidebarStatus.textContent = "offline";
  }
}

// ---- boot -----------------------------------------------------------------

applyTheme(settings.theme);
initSettingsUI();
applyI18n(settings.lang);
renderSuggestions();
loadStatus();
