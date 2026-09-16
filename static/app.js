const log = document.getElementById("log");
const form = document.getElementById("composer");
const input = document.getElementById("question");
const statusEl = document.getElementById("status");

function addMessage(role, text, sources) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);

  if (sources && sources.length) {
    const wrap = document.createElement("div");
    wrap.className = "sources";
    sources.forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "source-chip";
      chip.textContent = s;
      wrap.appendChild(chip);
    });
    div.appendChild(wrap);
  }

  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    statusEl.textContent =
      `offline - ${data.documents} doc(s), ${data.chunks} chunk(s) - ` +
      `embeddings: ${data.embedding_backend} - model: ${data.llm_backend}`;
  } catch (err) {
    statusEl.textContent = "status unavailable";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  addMessage("user", question);
  input.value = "";
  input.disabled = true;

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    if (!res.ok) {
      addMessage("error", data.error || "Something went wrong.");
    } else {
      addMessage("assistant", data.answer, data.sources);
    }
  } catch (err) {
    addMessage("error", "Could not reach the server.");
  } finally {
    input.disabled = false;
    input.focus();
  }
});

loadStatus();
