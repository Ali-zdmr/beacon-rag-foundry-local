"""Ingestion pipeline: read documents -> chunk -> embed -> store in SQLite.

Usage:
    python -m src.ingest [--docs-dir data/documents] [--db data/knowledge.db] [--reset]
"""

import argparse
from pathlib import Path

from . import config, db
from .chunking import split_into_chunks
from .embeddings import get_embedding_backend

SUPPORTED_EXTENSIONS = {".md", ".txt"}


def load_documents(docs_dir: Path) -> list[tuple[str, str]]:
    """Return a list of (filename, text) for every supported file in docs_dir."""
    docs = []
    for path in sorted(docs_dir.iterdir()):
        if path.suffix.lower() in SUPPORTED_EXTENSIONS:
            docs.append((path.name, path.read_text(encoding="utf-8")))
    return docs


def title_from_text(filename: str, text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip().lstrip("#").strip()
        if stripped:
            return stripped
    return filename


def run(docs_dir: Path, db_path: Path, reset: bool = True) -> None:
    if not docs_dir.exists():
        raise SystemExit(f"Documents directory not found: {docs_dir}")

    documents = load_documents(docs_dir)
    if not documents:
        raise SystemExit(f"No .md or .txt files found in {docs_dir}")

    embedder = get_embedding_backend()
    db.init_db(db_path, reset=reset)

    total_chunks = 0
    with db.connect(db_path) as conn:
        db.set_meta(conn, "embedding_backend", embedder.name)
        for filename, text in documents:
            title = title_from_text(filename, text)
            chunks = split_into_chunks(
                text, max_chars=config.CHUNK_MAX_CHARS, overlap=config.CHUNK_OVERLAP_CHARS
            )
            if not chunks:
                continue
            doc_id = db.insert_document(conn, filename, title)
            vectors = embedder.embed(chunks)
            for idx, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
                db.insert_chunk(conn, doc_id, idx, chunk_text, vector)
            total_chunks += len(chunks)
            print(f"  ingested {filename!r} -> {len(chunks)} chunk(s)")

    print(
        f"Done. {len(documents)} document(s), {total_chunks} chunk(s) stored in {db_path} "
        f"(embedding backend: {embedder.name})."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest documents into the local knowledge base.")
    parser.add_argument("--docs-dir", type=Path, default=config.DOCS_DIR)
    parser.add_argument("--db", type=Path, default=config.DB_PATH)
    parser.add_argument(
        "--no-reset", action="store_true", help="Append to the existing database instead of rebuilding it."
    )
    args = parser.parse_args()
    run(args.docs_dir, args.db, reset=not args.no_reset)


if __name__ == "__main__":
    main()
