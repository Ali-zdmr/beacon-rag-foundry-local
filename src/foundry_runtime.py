"""Shared plumbing for talking to a real Microsoft Foundry Local runtime.

Both embeddings.py and llm.py need a live FoundryLocalManager and a loaded
model - this module owns that shared setup so there's exactly one manager
per process (the SDK enforces this as a singleton anyway: constructing a
second FoundryLocalManager while one is alive raises).

This targets foundry-local-sdk 2.x, whose API differs from the simpler
`FoundryLocalManager(alias)` pattern shown in older tutorials - that older
shape stopped working once the SDK moved to a Configuration/Catalog/IModel
design. get_ready_model() is the thin translation layer so the rest of the
app doesn't need to know which SDK generation it's talking to.
"""

from foundry_local_sdk import Configuration, FoundryLocalManager


def get_manager() -> FoundryLocalManager:
    if FoundryLocalManager.instance is not None:
        return FoundryLocalManager.instance
    return FoundryLocalManager(Configuration(app_name="Beacon"))


def get_ready_model(alias: str):
    """Look up a model by alias, downloading and loading it if needed.

    Raises RuntimeError if the alias isn't in the catalog at all - callers
    treat that the same as "Foundry Local unavailable" and fall back.
    """
    manager = get_manager()
    model = manager.catalog.get_model(alias)
    if model is None:
        raise RuntimeError(f"No Foundry Local model found for alias '{alias}'")
    model.download()
    model.load()
    return model
