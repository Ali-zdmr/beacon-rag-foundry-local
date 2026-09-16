"""Embedding backends.

FoundryLocalEmbeddings talks to a real, locally installed Microsoft Foundry
Local runtime: it looks up the model by alias, downloads/loads it if needed,
and uses the SDK's OpenAI-compatible embedding client - verified end-to-end
against foundry-local-sdk 2.0.1 and a real qwen3-embedding-0.6b model.

HashingEmbeddings is a pure-Python/numpy fallback with no external
dependencies or downloads, so the whole pipeline still runs end-to-end (fully
offline) on a machine that doesn't have Foundry Local installed yet - useful
for development, grading, and CI.
"""

import hashlib
import re
from abc import ABC, abstractmethod

import numpy as np

from . import config

_TOKEN_RE = re.compile(r"[a-zA-ZçğıöşüÇĞİÖŞÜ0-9]+")


class EmbeddingBackend(ABC):
    name: str

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class FoundryLocalEmbeddings(EmbeddingBackend):
    name = "foundry-local"

    def __init__(self, alias: str = config.EMBEDDING_MODEL_ALIAS):
        from .foundry_runtime import get_ready_model

        model = get_ready_model(alias)
        self._client = model.get_embedding_client()
        # Fail fast if inference doesn't actually work.
        self._client.generate_embeddings(["healthcheck"])

    def embed(self, texts: list[str]) -> list[list[float]]:
        response = self._client.generate_embeddings(texts)
        return [item.embedding for item in response.data]


class HashingEmbeddings(EmbeddingBackend):
    """Deterministic bag-of-words hashing vectorizer. No network, no downloads."""

    name = "offline-hashing-fallback"

    def __init__(self, dim: int = config.FALLBACK_EMBEDDING_DIM):
        self.dim = dim

    def _vectorize(self, text: str) -> list[float]:
        vec = np.zeros(self.dim, dtype=np.float64)
        tokens = _TOKEN_RE.findall(text.lower())
        for tok in tokens:
            digest = hashlib.sha256(tok.encode("utf-8")).digest()
            idx = int.from_bytes(digest[:4], "big") % self.dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vec[idx] += sign
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec.tolist()

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vectorize(t) for t in texts]


def get_embedding_backend() -> EmbeddingBackend:
    try:
        backend = FoundryLocalEmbeddings()
        print(f"[embeddings] Using Foundry Local model '{config.EMBEDDING_MODEL_ALIAS}'.")
        return backend
    except Exception as exc:  # noqa: BLE001 - any failure means "not available"
        print(
            "[embeddings] Foundry Local not available "
            f"({exc.__class__.__name__}: {exc}). Falling back to offline hashing embeddings."
        )
        return HashingEmbeddings()
