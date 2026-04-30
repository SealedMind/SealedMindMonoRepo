"""evermemos-sealedmind addon registration.

Loaded by 0G Memory's `AddonsRegistry.load_entrypoints()` from the
`memsys.addons` entry-point group (declared in `pyproject.toml`).

What this module does on import:
  1. Registers an `AddonRegistry(name="sealedmind")` with `ADDONS_REGISTRY`.
  2. Adds our package's component directory to the DI scan paths so 0G
     Memory's DI scanner picks up our `@component(...)` classes.
  3. The components themselves (the lifespan that handles
     `KV_STORAGE_TYPE=sealedmind`) live under `evermemos_sealedmind.components`.

Activation by the operator:
    pip install evermemos-sealedmind
    export MEMSYS_ENTRYPOINTS_FILTER=core,sealedmind
    export KV_STORAGE_TYPE=sealedmind
    export SEALEDMIND_BACKUP_KEY=<32-byte hex>            # for WalletVault
"""
from __future__ import annotations

import os
from pathlib import Path

# Imports from 0G Memory. We import lazily inside register() so the package
# is importable for tests without the full memsys dependency tree.

_PACKAGE_ROOT = Path(__file__).resolve().parent
COMPONENTS_PATH = str(_PACKAGE_ROOT / "components")


def register() -> None:
    """Register the SealedMind addon with 0G Memory's addon registry.

    Safe to call multiple times — `AddonsRegistry.register()` overwrites by
    name in 0G Memory's implementation.
    """
    try:
        from core.addons.addon_registry import AddonRegistry
        from core.addons.addons_registry import ADDONS_REGISTRY
        from core.di.scan_path_registry import ScannerPathsRegistry
    except ImportError as exc:
        raise RuntimeError(
            "evermemos-sealedmind addon import requires the `memsys` package "
            "(0g-memory) on the PYTHONPATH"
        ) from exc

    paths = ScannerPathsRegistry()
    paths.add_scan_path(COMPONENTS_PATH)

    addon = AddonRegistry(name="sealedmind")
    addon.register_di(paths)
    ADDONS_REGISTRY.register(addon)


# 0G Memory loads the entry-point's *module* (not a callable), so the
# registration must run on import.  Allow opt-out via env so tests that
# import the package without 0G Memory installed don't blow up.
if os.environ.get("EVERMEMOS_SEALEDMIND_AUTO_REGISTER", "1") == "1":
    try:
        register()
    except RuntimeError:
        # 0G Memory not on the path — skip silently.  The user gets a clear
        # error if they try to actually USE the addon outside memsys.
        pass
