// ---- persisted settings -----------------------------------------------

const SETTINGS_KEY = "beacon.settings";

function loadSettings() {
  const defaults = {
    theme: "dark",
    lang: "tr",
    topK: 3,
    showSources: true,
    confidenceThreshold: 0.15,
  };
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
let lastStatus = null;

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
const btnExportChat = document.getElementById("btn-export-chat");

const docStats = document.getElementById("doc-stats");
const docSearch = document.getElementById("doc-search");
const docList = document.getElementById("doc-list");
const dropzone = document.getElementById("dropzone");
const uploadInput = document.getElementById("upload-input");
const btnReindex = document.getElementById("btn-reindex");

const testsSummary = document.getElementById("tests-summary");
const testForm = document.getElementById("test-form");
const testQuestion = document.getElementById("test-question");
const testNote = document.getElementById("test-note");
const testList = document.getElementById("test-list");
const btnRunAllTests = document.getElementById("btn-run-all-tests");

const topkInput = document.getElementById("setting-topk");
const topkValue = document.getElementById("setting-topk-value");
const showSourcesInput = document.getElementById("setting-show-sources");
const confidenceInput = document.getElementById("setting-confidence");
const confidenceValue = document.getElementById("setting-confidence-value");
const themeSelect = document.getElementById("setting-theme");
const langSelect = document.getElementById("setting-lang");
const backendDetails = document.getElementById("backend-details");
const pipelineDetails = document.getElementById("pipeline-details");

// ---- navigation -----------------------------------------------------------

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("active"));
    views.forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    if (btn.dataset.view === "docs") loadDocuments();
    if (btn.dataset.view === "settings") loadStatus();
    if (btn.dataset.view === "tests") loadTests();
  });
});

// ---- chat -----------------------------------------------------------------

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function revealText(el, text) {
  const total = text.length;
  const duration = Math.min(900, Math.max(200, total * 4));
  const start = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    el.textContent = text.slice(0, Math.floor(progress * total));
    log.scrollTop = log.scrollHeight;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function confidenceInfo(chunks) {
  if (!chunks || !chunks.length) {
    return { cls: "none", label: t(settings.lang, "chat.confidenceNone") };
  }
  const top = chunks[0].score;
  if (top < settings.confidenceThreshold) {
    return { cls: "low", label: `${t(settings.lang, "chat.confidenceLow")} (${top})` };
  }
  return { cls: "good", label: `${t(settings.lang, "chat.confidenceGood")} (${top})` };
}

function addMessage(role, text, options = {}) {
  const { chunks, elapsedMs, animate } = options;
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  const p = document.createElement("p");
  div.appendChild(p);
  if (role === "assistant" && animate) {
    revealText(p, text);
  } else {
    p.textContent = text;
  }

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

  if (role === "user" || role === "assistant") {
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    let metaText = formatTime(new Date());
    if (typeof elapsedMs === "number") metaText += ` - ${elapsedMs} ms`;
    const timeSpan = document.createElement("span");
    timeSpan.textContent = metaText;
    meta.appendChild(timeSpan);

    if (role === "assistant") {
      if (chunks !== undefined) {
        const info = confidenceInfo(chunks);
        const badge = document.createElement("span");
        badge.className = `confidence-badge ${info.cls}`;
        badge.textContent = info.label;
        meta.appendChild(badge);
      }

      const copyBtn = document.createElement("button");
      copyBtn.className = "msg-copy-btn";
      copyBtn.textContent = t(settings.lang, "chat.copy");
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = t(settings.lang, "chat.copied");
          setTimeout(() => (copyBtn.textContent = t(settings.lang, "chat.copy")), 1500);
        } catch (err) {
          /* clipboard unavailable - ignore */
        }
      });
      meta.appendChild(copyBtn);
    }
    div.appendChild(meta);
  }

  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const div = document.createElement("div");
  div.className = "msg assistant typing-msg";
  div.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

async function ask(text) {
  addMessage("user", text);
  question.value = "";
  question.disabled = true;
  const typingEl = addTypingIndicator();

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, top_k: settings.topK }),
    });
    const data = await res.json();
    typingEl.remove();
    if (!res.ok) {
      addMessage("error", data.error || t(settings.lang, "chat.noAnswer"));
    } else {
      addMessage("assistant", data.answer, {
        chunks: data.chunks,
        elapsedMs: data.elapsed_ms,
        animate: true,
      });
    }
  } catch (err) {
    typingEl.remove();
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

btnExportChat.addEventListener("click", () => {
  const lines = [];
  log.querySelectorAll(".msg").forEach((el) => {
    const roleLabel = el.classList.contains("user") ? "You" : "Beacon";
    const text = el.querySelector("p")?.textContent || "";
    if (text) lines.push(`**${roleLabel}:** ${text}`);
  });
  const blob = new Blob([lines.join("\n\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "beacon-conversation.md";
  a.click();
  URL.revokeObjectURL(url);
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

let allDocuments = [];

function renderDocStats() {
  const totalDocs = allDocuments.length;
  const totalChunks = allDocuments.reduce((sum, d) => sum + d.chunk_count, 0);
  const avg = totalDocs ? (totalChunks / totalDocs).toFixed(1) : "0";
  docStats.innerHTML = `
    <div><strong>${totalDocs}</strong>${t(settings.lang, "docs.statsTotal")}</div>
    <div><strong>${totalChunks}</strong>${t(settings.lang, "docs.statsChunks")}</div>
    <div><strong>${avg}</strong>${t(settings.lang, "docs.statsAvg")}</div>
  `;
}

function renderDocList() {
  const filter = (docSearch.value || "").toLowerCase();
  const filtered = allDocuments.filter(
    (d) => d.title.toLowerCase().includes(filter) || d.filename.toLowerCase().includes(filter)
  );

  docList.innerHTML = "";
  if (!allDocuments.length) {
    docList.innerHTML = `<li class="hint">${t(settings.lang, "docs.empty")}</li>`;
    return;
  }
  if (!filtered.length) {
    docList.innerHTML = `<li class="hint">${t(settings.lang, "docs.noMatch")}</li>`;
    return;
  }

  filtered.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "doc-row";

    const main = document.createElement("div");
    main.className = "doc-row-main";

    const info = document.createElement("div");
    info.className = "doc-info";
    info.innerHTML =
      `<div class="doc-title">${doc.title}</div>` +
      `<div class="doc-meta">${doc.filename} - ${doc.chunk_count} ${t(settings.lang, "docs.chunks")}</div>`;

    const actions = document.createElement("div");
    actions.className = "doc-row-actions";

    const previewBtn = document.createElement("button");
    previewBtn.className = "ghost-btn";
    previewBtn.textContent = t(settings.lang, "docs.preview");

    const del = document.createElement("button");
    del.className = "doc-delete";
    del.textContent = t(settings.lang, "docs.delete");
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteDocument(doc.filename);
    });

    actions.appendChild(previewBtn);
    actions.appendChild(del);
    main.appendChild(info);
    main.appendChild(actions);
    li.appendChild(main);

    const previewWrap = document.createElement("div");
    previewWrap.style.display = "none";
    li.appendChild(previewWrap);

    previewBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const isOpen = previewWrap.style.display !== "none";
      if (isOpen) {
        previewWrap.style.display = "none";
        return;
      }
      if (!previewWrap.dataset.loaded) {
        const res = await fetch(`/api/documents/${encodeURIComponent(doc.filename)}/chunks`);
        const data = await res.json();
        previewWrap.className = "doc-preview";
        previewWrap.innerHTML = "";
        (data.chunks || []).forEach((c) => {
          const chunkEl = document.createElement("div");
          chunkEl.className = "doc-chunk";
          const preview = c.text.length > 200 ? c.text.slice(0, 200) + "..." : c.text;
          chunkEl.innerHTML = `<span class="chunk-index">#${c.index}</span>${preview}`;
          previewWrap.appendChild(chunkEl);
        });
        previewWrap.dataset.loaded = "1";
      }
      previewWrap.style.display = "flex";
    });

    docList.appendChild(li);
  });
}

async function loadDocuments() {
  try {
    const res = await fetch("/api/documents");
    const data = await res.json();
    allDocuments = data.documents || [];
    renderDocStats();
    renderDocList();
  } catch (err) {
    docList.innerHTML = `<li class="hint">${t(settings.lang, "chat.noServer")}</li>`;
  }
}

docSearch.addEventListener("input", renderDocList);

async function deleteDocument(filename) {
  await fetch(`/api/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
  loadDocuments();
  loadStatus();
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  await fetch("/api/documents", { method: "POST", body: formData });
  loadDocuments();
  loadStatus();
}

dropzone.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", () => {
  uploadFiles(uploadInput.files);
  uploadInput.value = "";
});
["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  uploadFiles(e.dataTransfer.files);
});

btnReindex.addEventListener("click", async () => {
  await fetch("/api/reindex", { method: "POST" });
  loadDocuments();
  loadStatus();
});

// ---- tests --------------------------------------------------------------

function renderTestStats(tests) {
  const total = tests.length;
  const passed = tests.filter((c) => c.verdict === "pass").length;
  const failed = tests.filter((c) => c.verdict === "fail").length;
  testsSummary.innerHTML = `
    <div><strong>${total}</strong>${t(settings.lang, "tests.statsTotal")}</div>
    <div><strong>${passed}</strong>${t(settings.lang, "tests.statsPassed")}</div>
    <div><strong>${failed}</strong>${t(settings.lang, "tests.statsFailed")}</div>
  `;
}

function renderTestList(tests) {
  testList.innerHTML = "";
  if (!tests.length) {
    testList.innerHTML = `<li class="hint">${t(settings.lang, "tests.empty")}</li>`;
    return;
  }

  tests.forEach((tc) => {
    const li = document.createElement("li");
    li.className = "doc-row";

    const main = document.createElement("div");
    main.className = "test-row-main";

    const info = document.createElement("div");
    info.className = "test-info";
    let infoHtml = `<div class="test-question">${tc.question}</div>`;
    if (tc.expected_note) infoHtml += `<div class="test-note">${tc.expected_note}</div>`;
    infoHtml += `<div class="test-meta">${tc.last_run_at ? tc.last_run_at : t(settings.lang, "tests.notRun")}</div>`;
    info.innerHTML = infoHtml;

    const actions = document.createElement("div");
    actions.className = "test-row-actions";

    const runBtn = document.createElement("button");
    runBtn.className = "ghost-btn";
    runBtn.textContent = t(settings.lang, "tests.run");
    runBtn.addEventListener("click", () => runTest(tc.id));

    const passBtn = document.createElement("button");
    passBtn.className = `verdict-btn pass ${tc.verdict === "pass" ? "active" : ""}`;
    passBtn.textContent = t(settings.lang, "tests.pass");
    passBtn.addEventListener("click", () => setVerdict(tc.id, tc.verdict === "pass" ? null : "pass"));

    const failBtn = document.createElement("button");
    failBtn.className = `verdict-btn fail ${tc.verdict === "fail" ? "active" : ""}`;
    failBtn.textContent = t(settings.lang, "tests.fail");
    failBtn.addEventListener("click", () => setVerdict(tc.id, tc.verdict === "fail" ? null : "fail"));

    const delBtn = document.createElement("button");
    delBtn.className = "doc-delete";
    delBtn.textContent = t(settings.lang, "tests.delete");
    delBtn.addEventListener("click", () => deleteTest(tc.id));

    actions.appendChild(runBtn);
    actions.appendChild(passBtn);
    actions.appendChild(failBtn);
    actions.appendChild(delBtn);
    main.appendChild(info);
    main.appendChild(actions);
    li.appendChild(main);

    if (tc.last_answer) {
      const answerEl = document.createElement("div");
      answerEl.className = "test-answer";
      answerEl.textContent = tc.last_answer;
      li.appendChild(answerEl);
    }

    testList.appendChild(li);
  });
}

function renderTests(tests) {
  renderTestStats(tests);
  renderTestList(tests);
}

async function loadTests() {
  try {
    const res = await fetch("/api/tests");
    const data = await res.json();
    renderTests(data.tests || []);
  } catch (err) {
    testList.innerHTML = `<li class="hint">${t(settings.lang, "chat.noServer")}</li>`;
  }
}

testForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = testQuestion.value.trim();
  if (!q) return;
  await fetch("/api/tests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q, expected_note: testNote.value.trim() }),
  });
  testQuestion.value = "";
  testNote.value = "";
  loadTests();
});

async function runTest(id) {
  await fetch(`/api/tests/${id}/run`, { method: "POST" });
  loadTests();
}

btnRunAllTests.addEventListener("click", async () => {
  btnRunAllTests.disabled = true;
  try {
    await fetch("/api/tests/run-all", { method: "POST" });
    loadTests();
  } finally {
    btnRunAllTests.disabled = false;
  }
});

async function deleteTest(id) {
  await fetch(`/api/tests/${id}`, { method: "DELETE" });
  loadTests();
}

async function setVerdict(id, verdict) {
  await fetch(`/api/tests/${id}/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verdict }),
  });
  loadTests();
}

// ---- settings -----------------------------------------------------------

function initSettingsUI() {
  topkInput.value = settings.topK;
  topkValue.textContent = settings.topK;
  showSourcesInput.checked = settings.showSources;
  confidenceInput.value = settings.confidenceThreshold;
  confidenceValue.textContent = settings.confidenceThreshold;
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

confidenceInput.addEventListener("input", () => {
  settings.confidenceThreshold = parseFloat(confidenceInput.value);
  confidenceValue.textContent = settings.confidenceThreshold;
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
  if (allDocuments.length || docList.children.length) {
    renderDocStats();
    renderDocList();
  }
  if (lastStatus) renderBackendDetails(lastStatus);
  saveSettings(settings);
});

// ---- status ---------------------------------------------------------------

function renderBackendDetails(data) {
  backendDetails.innerHTML =
    `embeddings: <code>${data.embedding_backend}</code><br>` +
    `model: <code>${data.llm_backend}</code>`;
  pipelineDetails.innerHTML =
    `LLM alias: <code>${data.llm_alias}</code><br>` +
    `Embedding alias: <code>${data.embedding_alias}</code><br>` +
    `Chunk size / overlap: <code>${data.chunk_max_chars} / ${data.chunk_overlap_chars}</code> chars<br>` +
    `Default top-k: <code>${data.default_top_k}</code>`;
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    lastStatus = data;
    sidebarStatus.textContent = `${data.documents} docs - ${data.chunks} chunks`;
    renderBackendDetails(data);
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
