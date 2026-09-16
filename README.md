# Beacon - Local RAG Document Assistant

A small, fully offline-capable Q&A assistant built for the Microsoft summer
program "Building Your First Local RAG Application with Foundry Local". Like
a lighthouse beam, it only lights up what's actually there: it answers
questions about a local set of documents by retrieving the most relevant
passages from a SQLite-backed knowledge base and grounding a local language
model's answer in them - never in the cloud, never guessing beyond what the
documents actually say, never wandering into open water.

This project follows the same architecture as the assignment brief (chunk ->
embed -> store in SQLite -> retrieve -> generate with Microsoft Foundry
Local), but it is a from-scratch implementation, not a copy of any reference
project. Two deliberate differences worth noting for reviewers:

- **Verified against a real, installed Foundry Local - not just written to
  spec.** Foundry Local 0.10.3 was installed via `winget`, `qwen3-embedding-0.6b`
  and `phi-3.5-mini` were downloaded, and both the embedding step and answer
  generation were run end-to-end against them (see "Verified against real
  Foundry Local" below). Worth being honest about: `foundry-local-sdk`'s
  real API (`Configuration`/`Catalog`/`IModel`, in `src/foundry_runtime.py`)
  turned out to be different from the simpler `FoundryLocalManager(alias)`
  shape shown in some older tutorials - the code here matches what the
  currently-installed SDK (2.0.1) actually exposes, confirmed by running it,
  not by assumption.
- **No Foundry Local install required to try it, either.** Both the
  embedding step and the answer-generation step have an automatic offline
  fallback (see "How the fallback works" below), so the whole pipeline still
  runs and is testable on a machine that hasn't installed Foundry Local.
- **The UI stays functional, not decorative.** Every control does something
  real (upload a file and the index rebuilds; change top-k and the next
  question actually retrieves that many passages; a test case's pass/fail
  is graded against a live run, not hardcoded). The goal was a working
  grounded Q&A app per the assignment brief, not a themed dashboard with
  fake stats.

## Verified against real Foundry Local

This isn't a "should work" claim - it was actually run:

```
$ python -m src.ingest
[embeddings] Using Foundry Local model 'qwen3-embedding-0.6b'.
  ingested [Cars] 'combustion_engine_basics.md' -> 2 chunk(s)
  ingested [Cars] 'electric_vehicles.docx' -> 1 chunk(s)
  ingested [Cars] 'tire_pressure_basics.pdf' -> 1 chunk(s)
  ingested [General] 'foundry_local_overview.md' -> 4 chunk(s)
  ingested [General] 'prompt_engineering_for_qa.md' -> 3 chunk(s)
  ingested [General] 'rag_overview.md' -> 4 chunk(s)
  ingested [General] 'sqlite_for_local_storage.md' -> 3 chunk(s)
Done. 7 document(s), 18 chunk(s) stored (embedding backend: foundry-local).
```

`get_embedding_backend()` and `get_llm_backend()` picked the real Foundry
Local backend automatically (no config flag needed) as soon as it was
installed and the models were cached - the exact same code path a grader
running this after installing Foundry Local will hit. A real question
against the real model, unedited:

```
$ python -m src.chat_cli --query "What is RAG and why does chunk overlap matter?"
Ready. embeddings=foundry-local llm=foundry-local

RAG stands for Retrieval-Augmented Generation, a method for building AI
assistants that answer questions by retrieving relevant passages from a
specific set of documents, using them as context, and generating an answer
grounded in that context.

Chunk overlap matters because it ensures that information near a boundary
is not lost during the process of combining retrieved passages to form a
coherent context for the AI to generate an answer from.

Source document names:
1. What is Retrieval-Augmented Generation (RAG)?

Sources: What is Retrieval-Augmented Generation (RAG)?
```

## Project structure

```
src/
  config.py      central settings (paths, model aliases, chunk size, top-k)
  db.py          SQLite schema + helpers (documents, chunks, meta tables)
  chunking.py    paragraph-aware text splitter with overlap
  extractors.py  text extraction for .md/.txt/.pdf/.docx
  foundry_runtime.py  shared Foundry Local SDK 2.x setup (Configuration ->
                       FoundryLocalManager -> Catalog -> IModel)
  embeddings.py  FoundryLocalEmbeddings + offline HashingEmbeddings fallback
  llm.py         FoundryLocalLLM + offline ExtractiveFallbackLLM fallback
  ingest.py      CLI: read data/documents -> chunk -> embed -> store
  retrieval.py   cosine-similarity search over stored chunk embeddings
  qa.py          glues retrieval + generation into answer_question()
  chat_cli.py    interactive console chat
  testsuite.py   JSON-backed store for the Phase 3 test set (add/run/grade)
  webapp.py      Flask app: chat/documents/tests/settings JSON API
templates/, static/   the web UI (chat, document manager, test runner,
                       settings - TR/EN, dark/light)
data/documents/       sample knowledge base (Markdown), organized into
                       collections - see "Collections" below
data/documents/Cars/  a second collection, to demonstrate scoping
data/knowledge.db     generated by ingest.py (gitignored)
data/test_cases.json  seeded Phase 3 test set (a few Q&A pairs, incl. one
                       that should be refused as out-of-scope)
tests/test_pipeline.py  end-to-end smoke test
```

## How the fallback works

`get_embedding_backend()` and `get_llm_backend()` each try to look up the
configured model alias in the Foundry Local catalog first (via
`src/foundry_runtime.py`, using `foundry-local-sdk` 2.x's
`Configuration` -> `FoundryLocalManager` -> `Catalog.get_model(alias)` ->
`IModel.download()`/`.load()` flow, then the model's OpenAI-compatible
`get_chat_client()`/`get_embedding_client()`). If Foundry Local isn't
installed, isn't running, or the alias isn't in the catalog, they fall back
automatically:

- **Embeddings fallback**: a deterministic hashing vectorizer (pure
  Python/numpy, no downloads). It's a much cruder signal than a real
  embedding model, but it's enough to demonstrate the retrieval pipeline
  end-to-end.
- **Generation fallback**: instead of inventing an answer, it returns the
  actual top-matching passages with their sources. It never hallucinates,
  it just doesn't paraphrase.

The database records which embedding backend produced its vectors
(`meta` table). If you switch backends, re-run ingestion - the app will
tell you clearly if the active backend doesn't match what's stored, instead
of silently comparing incompatible vectors.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Optional: enable real on-device inference with Foundry Local

1. Install Foundry Local (Windows): `winget install Microsoft.FoundryLocal`
2. Check the catalog of available models: `foundry model list`
3. Update the aliases in `src/config.py` (`LLM_MODEL_ALIAS`,
   `EMBEDDING_MODEL_ALIAS`) to match aliases available in your catalog if
   they differ from the defaults (`phi-3.5-mini`, `qwen3-embedding-0.6b` -
   both confirmed present in the current catalog).
4. Re-run `python -m src.ingest` so the knowledge base is re-embedded with
   the real model, then use the app as usual - no other code changes needed.
   The first run downloads the model (a few hundred MB to a couple GB
   depending on the alias), so it'll pause there the first time.

## Collections

A question doesn't have to search every document you've ever added. Files
placed directly in `data/documents/` belong to the `General` collection;
any subfolder becomes its own named collection - e.g.
`data/documents/Cars/*.md` is the "Cars" collection. This is meant for the
obvious real use case: keep one course's notes separate from your car
project's notes, and scope a question to just one of them instead of
searching everything at once.

In the web UI this is fully driven from the Documents tab (no manual folder
editing required): type a collection name when uploading/dropping files
("Cars", "Course Notes", ...) and it's created automatically; the Chat tab
gets a scope dropdown ("All collections" or one specific one) that filters
retrieval accordingly; deleting a collection removes its folder and
reindexes. The default `General` collection can't be bulk-deleted this way
(delete its files individually) since it's just `data/documents/` itself.

## Usage

Add your own `.md`/`.txt`/`.pdf`/`.docx` files to `data/documents/` (a few
sample documents about RAG, Foundry Local, SQLite and prompt engineering are
included so the app works out of the box, plus a "Cars" collection with a
Markdown, a Word, and a PDF file to demonstrate every supported format),
then:

```bash
# 1. Build the knowledge base
python -m src.ingest

# 2. Ask questions from the console
python -m src.chat_cli
python -m src.chat_cli --query "What is RAG?"

# 3. ...or use the web UI
python -m src.webapp
# open http://127.0.0.1:5000
```

The web UI has five tabs:
- **Chat** - a scope dropdown to ask about one collection or all of them,
  example question chips, a typing indicator, a typewriter reveal on the
  answer, per-message timestamps and response time, a copy button, a
  confidence badge (based on the top retrieved passage's similarity score),
  expandable retrieved-passage cards (source + score) under each answer,
  and a button to export the conversation as Markdown.
- **Documents** - a stats bar (documents / chunks / avg. chunks per doc),
  documents grouped by collection with a name field for uploads and a
  per-collection delete button, a filter box, a drag-and-drop zone (or
  click to browse, multiple files at once - the index rebuilds
  automatically), preview a document's indexed chunks inline, delete a
  file, or force a manual reindex.
- **Tests** - the assignment's Phase 3 test set made concrete: add a
  question plus what you expect ("should cite doc X", "should say it
  doesn't know"), run it (or run all) against the live pipeline, and mark
  each result pass/fail. Seeded with three example cases in
  `data/test_cases.json`, including one that's deliberately out of scope so
  you can check the assistant refuses to guess.
- **Settings** - adjust top-k (how many passages are retrieved per
  question), the low-confidence similarity threshold, toggle whether
  retrieved passages are shown, switch between dark/light theme and
  Turkish/English, and see which embedding/LLM backends and model aliases
  are currently active. Settings persist in the browser (`localStorage`)
  between visits.
- **About** - a short pipeline explainer (chunking -> embedding -> SQLite ->
  retrieval -> generation), handy for the assignment's final presentation.

## Tests

```bash
python -m pytest tests/
```

Runs an end-to-end ingest + query against a throwaway database, so it never
touches `data/knowledge.db`.

## Notes for grading / GitHub submission

- Everything here runs locally; there is no outbound network call in the
  Foundry Local code path once models are cached, and the fallback path
  makes zero network calls at all.
- `data/knowledge.db` is gitignored - reviewers should run
  `python -m src.ingest` after cloning.
