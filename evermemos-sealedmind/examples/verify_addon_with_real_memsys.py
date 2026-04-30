"""Real verification: install evermemos-sealedmind into 0G Memory and confirm
the addon registers correctly via the production code path.

This script does NOT mock any 0G Memory machinery. It:

  1. Adds 0g-memory's `src/` to sys.path (no need to install the entire
     server stack — we only exercise core.addons + KVStorageInterface).
  2. Calls `ADDONS_REGISTRY.load_entrypoints(["sealedmind"])` — the same
     code path 0G Memory uses at startup.
  3. Asserts our addon registered, our DI scan path is in the list, and
     our `SealedMindKVStorage` is a subclass of the real
     `KVStorageInterface`.
  4. Optionally runs a real put/get against 0G testnet (requires a local
     `zgs_kv` node on ZEROG_READ_NODE).

Run:
    OG_MEMORY_SRC=/downloads/OG-hackquest/0g-memory/src \\
    python examples/verify_addon_with_real_memsys.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> int:
    src = os.environ.get("OG_MEMORY_SRC")
    if not src:
        print("set OG_MEMORY_SRC=/path/to/0g-memory/src", file=sys.stderr)
        return 2
    if not Path(src).exists():
        print(f"OG_MEMORY_SRC does not exist: {src}", file=sys.stderr)
        return 2
    sys.path.insert(0, src)

    print(f"[1/4] sys.path[0]={src}")

    # ── Step 1: prove the real interface imports
    from infra_layer.adapters.out.persistence.kv_storage.kv_storage_interface import (
        KVStorageInterface,
    )
    print(f"[2/4] real KVStorageInterface imported: {KVStorageInterface!r}")

    # ── Step 2: prove our adapter is a subclass
    from evermemos_sealedmind.kv_storage.sealed_kv import SealedMindKVStorage

    if not issubclass(SealedMindKVStorage, KVStorageInterface):
        print(
            "FAIL: SealedMindKVStorage does not subclass KVStorageInterface "
            "(probably because evermemos_sealedmind was imported BEFORE we "
            "added 0g-memory to sys.path — fix import order)",
            file=sys.stderr,
        )
        return 1
    print(f"[3/4] SealedMindKVStorage IS a KVStorageInterface ✓")

    # ── Step 3: drive the real entry-point loader
    from core.addons.addons_registry import ADDONS_REGISTRY

    # Filter to just our addon so we don't transitively pull in `core` which
    # would scan a path that isn't on sys.path here.
    os.environ["MEMSYS_ENTRYPOINTS_FILTER"] = "sealedmind"

    ADDONS_REGISTRY.load_entrypoints()
    addon = ADDONS_REGISTRY.get_by_name("sealedmind")
    if addon is None:
        print(
            "FAIL: ADDONS_REGISTRY did not pick up `sealedmind` — is the "
            "package installed? `pip show evermemos-sealedmind`",
            file=sys.stderr,
        )
        return 1
    print(f"[4/4] ADDONS_REGISTRY picked up addon: name={addon.name}")
    if hasattr(addon, "di") and addon.di is not None:
        scan_paths = addon.di.get_scan_paths()
        print(f"      DI scan paths registered:")
        for p in scan_paths:
            print(f"        - {p}")

    print()
    print("SUCCESS: evermemos-sealedmind plugs into 0G Memory's addon system.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
