"""Minimal Flask web UI for the local RAG assistant.

Deliberately small: a chat box plus a status strip showing which backends are
active and how many chunks are indexed. No accounts, no "security center"
theatre - just the Q&A loop the assignment asks for.

Usage:
    python -m src.webapp
"""

from pathlib import Path

from flask import Flask, jsonify, request, render_template

from . import config, db
from .embeddings import get_embedding_backend
from .llm import get_llm_backend
from .qa import answer_question
from .retrieval import EmbeddingBackendMismatch

app = Flask(
    __name__,
    template_folder=str(config.BASE_DIR / "templates"),
    static_folder=str(config.BASE_DIR / "static"),
)

_embedder = None
_llm = None


def _backends():
    global _embedder, _llm
    if _embedder is None:
        _embedder = get_embedding_backend()
    if _llm is None:
        _llm = get_llm_backend()
    return _embedder, _llm


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
        }
    )


@app.post("/api/ask")
def ask():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    embedder, llm = _backends()
    try:
        result = answer_question(question, embedder=embedder, llm=llm)
    except EmbeddingBackendMismatch as exc:
        return jsonify({"error": str(exc)}), 409

    return jsonify(result)


def main() -> None:
    _backends()  # warm up / print which backends are active before serving
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
