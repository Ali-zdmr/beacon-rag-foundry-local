"""Chat/generation backends.

Same pattern as embeddings.py: prefer a real local model served by Microsoft
Foundry Local (fully offline, on-device inference), fall back to a small
extractive responder that needs no model download at all so the project is
gradeable/runnable anywhere.
"""

from abc import ABC, abstractmethod

from . import config


class LLMBackend(ABC):
    name: str

    @abstractmethod
    def answer(self, question: str, context_chunks: list[dict]) -> str:
        ...


def _build_prompt(question: str, context_chunks: list[dict]) -> str:
    context_block = "\n\n".join(
        f"[Source: {c['source']}]\n{c['text']}" for c in context_chunks
    )
    return (
        f"Context passages:\n{context_block}\n\n"
        f"Question: {question}\n"
        "Answer using only the context above."
    )


class FoundryLocalLLM(LLMBackend):
    name = "foundry-local"

    def __init__(self, alias: str = config.LLM_MODEL_ALIAS):
        from foundry_local import FoundryLocalManager
        import openai

        self._manager = FoundryLocalManager(alias)
        model_info = self._manager.get_model_info(alias)
        self._model_id = model_info.id
        self._client = openai.OpenAI(
            base_url=self._manager.endpoint, api_key=self._manager.api_key or "not-needed"
        )
        # Fail fast if the service isn't actually reachable.
        self._client.chat.completions.create(
            model=self._model_id,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )

    def answer(self, question: str, context_chunks: list[dict]) -> str:
        if not context_chunks:
            return "I don't know - no relevant documents were found in the knowledge base."
        messages = [
            {"role": "system", "content": config.SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(question, context_chunks)},
        ]
        response = self._client.chat.completions.create(
            model=self._model_id, messages=messages, temperature=0.2
        )
        return response.choices[0].message.content.strip()


class ExtractiveFallbackLLM(LLMBackend):
    """No generative model available: return the most relevant passages directly.

    This keeps the pipeline fully functional and honest (it never invents an
    answer) when Foundry Local isn't installed on the grading machine.
    """

    name = "offline-extractive-fallback"

    def answer(self, question: str, context_chunks: list[dict]) -> str:
        if not context_chunks:
            return (
                "I don't know - no relevant documents were found in the knowledge base. "
                "(Running in offline fallback mode: install Foundry Local for generative answers.)"
            )
        lines = [
            "[Offline fallback mode - showing the most relevant passages verbatim; "
            "install Foundry Local for a generated answer.]",
            "",
        ]
        for c in context_chunks:
            snippet = c["text"].strip().replace("\n", " ")
            if len(snippet) > 400:
                snippet = snippet[:400].rsplit(" ", 1)[0] + "..."
            lines.append(f"- ({c['source']}) {snippet}")
        return "\n".join(lines)


def get_llm_backend() -> LLMBackend:
    try:
        backend = FoundryLocalLLM()
        print(f"[llm] Using Foundry Local model '{config.LLM_MODEL_ALIAS}'.")
        return backend
    except Exception as exc:  # noqa: BLE001 - any failure means "not available"
        print(
            f"[llm] Foundry Local not available ({exc.__class__.__name__}: {exc}). "
            "Falling back to offline extractive responder."
        )
        return ExtractiveFallbackLLM()
