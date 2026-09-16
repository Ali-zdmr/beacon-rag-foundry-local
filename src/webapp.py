"""Flask web UI for the local RAG assistant.

Four views in one page: Chat (ask questions, see cited/retrieved passages),
Documents (see what's indexed, upload new .md/.txt files, delete, reindex,
preview a document's chunks), Settings (top-k, whether to show retrieved
passages, theme, language, active model info), and About (a short pipeline
explainer for presentations). Everything here is a thin wrapper around the
same src.* pipeline used by the CLI - no logic lives only in the web layer.

Usage:
    python -m src.webapp
"""

import time
from pathlib import Path

from flask import Flask, jsonify, request, render_template
from werkzeug.utils import secure_filename

from . import config, db
from .embeddings import get_embedding_backend
from .ingest import run as ingest_run
from .llm import get_llm_backend
from .qa import answer_question
from .retrieval import EmbeddingBackendMismatch

app = Flask(
    __name__,
    template_folder=str(config.BASE_DIR / "templates"),
    static_folder=str(config.BASE_DIR / "static"),
)

ALLOWED_EXTENSIONS = {".md", ".txt"}

_embedder = None
_llm = None


def _backends():
    global _embedder, _llm
    if _embedder is None:
        _embedder = get_embedding_backend()
    if _llm is None:
        _llm = get_llm_backend()
    return _embedder, _llm


def _reindex():
    embedder, _ = _backends()
    ingest_run(config.DOCS_DIR, config.DB_PATH, reset=True, embedder=embedder)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/status")
def status():
    embedder, llm = _backends()
    db_path = Path(config.DB_PATH)
    num_chunks = num_docs = 0
    if db_path.exists():
        with db.connect(db_path) as conn:
            num_chunks = db.count_chunks(conn)
            num_docs = db.count_documents(conn)
    return jsonify(
        {
            "embedding_backend": embedder.name,
            "llm_backend": llm.name,
            "offline": True,
            "documents": num_docs,
            "chunks": num_chunks,
            "default_top_k": config.TOP_K,
            "llm_alias": config.LLM_MODEL_ALIAS,
            "embedding_alias": config.EMBEDDING_MODEL_ALIAS,
            "chunk_max_chars": config.CHUNK_MAX_CHARS,
            "chunk_overlap_chars": config.CHUNK_OVERLAP_CHARS,
        }
    )


@app.get("/api/documents")
def list_documents():
    db_path = Path(config.DB_PATH)
    documents = []
    if db_path.exists():
        with db.connect(db_path) as conn:
            documents = [dict(row) for row in db.list_documents_with_counts(conn)]
    return jsonify({"documents": documents})


@app.get("/api/documents/<path:filename>/chunks")
def document_chunks(filename):
    safe_name = secure_filename(filename)
    db_path = Path(config.DB_PATH)
    if not db_path.exists():
        return jsonify({"chunks": []})
    with db.connect(db_path) as conn:
        rows = db.fetch_chunks_for_document(conn, safe_name)
    return jsonify(
        {"chunks": [{"index": r["chunk_index"], "text": r["text"]} for r in rows]}
    )


@app.post("/api/documents")
def upload_document():
    if "file" not in request.files:
        return jsonify({"error": "no file provided"}), 400
    file = request.files["file"]
    filename = secure_filename(file.filename or "")
    if not filename:
        return jsonify({"error": "invalid filename"}), 400
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "only .md and .txt files are supported"}), 400

    config.DOCS_DIR.mkdir(parents=True, exist_ok=True)
    file.save(config.DOCS_DIR / filename)

    try:
        _reindex()
    except SystemExit as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True, "filename": filename})


@app.delete("/api/documents/<path:filename>")
def delete_document(filename):
    safe_name = secure_filename(filename)
    target = config.DOCS_DIR / safe_name
    if not target.exists():
        return jsonify({"error": "document not found"}), 404
    target.unlink()

    try:
        _reindex()
    except SystemExit:
        # last document was removed - clear the (now stale) database instead
        db.init_db(Path(config.DB_PATH), reset=True)
    return jsonify({"ok": True})


@app.post("/api/reindex")
def reindex():
    try:
        _reindex()
    except SystemExit as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"ok": True})


@app.post("/api/ask")
def ask():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    try:
        top_k = int(payload.get("top_k", config.TOP_K))
    except (TypeError, ValueError):
        top_k = config.TOP_K
    top_k = max(1, min(top_k, 10))

    embedder, llm = _backends()
    started = time.perf_counter()
    try:
        result = answer_question(question, k=top_k, embedder=embedder, llm=llm)
    except EmbeddingBackendMismatch as exc:
        return jsonify({"error": str(exc)}), 409
    result["elapsed_ms"] = round((time.perf_counter() - started) * 1000)

    return jsonify(result)


def main() -> None:
    _backends()  # warm up / print which backends are active before serving
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
