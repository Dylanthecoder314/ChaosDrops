"""Snapshot item IDs and loot-table paths from an installed Minecraft Education.

Run once (already done; output is committed in data/). Re-run after a game update:
    python3 tools/extract_game_data.py [/Applications/minecraft-edu.app]
"""
import glob
import json
import os
import re
import struct
import sys

APP = sys.argv[1] if len(sys.argv) > 1 else "/Applications/minecraft-edu.app"
BP_ROOT = os.path.join(APP, "Contents/Resources/data/behavior_packs")
OUT = os.path.join(os.path.dirname(__file__), "..", "data")


def read_brarchive(path):
    """Minimal reader for Mojang's .brarchive (16-byte header, 256-byte entries, then data)."""
    raw = open(path, "rb").read()
    count = struct.unpack("<I", raw[8:12])[0]
    entries = []
    for i in range(count):
        o = 16 + i * 256
        name = raw[o + 1 : o + 1 + raw[o]].decode()
        off, size = struct.unpack("<II", raw[o + 248 : o + 256])
        entries.append((name, off, size))
    base = 16 + count * 256
    return {name: raw[base + off : base + off + size] for name, off, size in entries}


def version_key(d):
    v = os.path.basename(d).replace("vanilla", "").strip("_") or "0"
    return tuple(int(x) for x in v.split("."))


def newest_catalog():
    cats = sorted(glob.glob(BP_ROOT + "/vanilla_*/item_catalog/crafting_item_catalog.json"), key=lambda p: version_key(os.path.dirname(os.path.dirname(p))))
    return cats[-1]


def catalog_items(path):
    """Return [(item_id, category)] preserving the creative-inventory category of each item."""
    text = open(path, encoding="utf-8").read()
    marks = [(m.start(), m.group(1)) for m in re.finditer(r'"category_name"\s*:\s*"([a-z_]+)"', text)]
    out, seen = [], set()
    for m in re.finditer(r'"(minecraft:[a-z0-9_]+)"', text):
        item = m.group(1)
        if item in seen:
            continue
        cat = "items"
        for pos, name in marks:
            if pos < m.start():
                cat = name
        seen.add(item)
        out.append((item, cat))
    return out


def loot_paths():
    paths = set()
    for d in glob.glob(BP_ROOT + "/vanilla*"):
        lt = os.path.join(d, "loot_tables")
        for f in glob.glob(lt + "/**/*.json", recursive=True):
            paths.add("loot_tables/" + os.path.relpath(f, lt))
        br = os.path.join(d, "__brarchive", "loot_tables.brarchive")
        if os.path.exists(br):
            paths.update("loot_tables/" + k for k in read_brarchive(br))
    return sorted(paths)


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = newest_catalog()
    items = catalog_items(cat)
    with open(os.path.join(OUT, "vanilla_items.json"), "w") as f:
        json.dump({"source": os.path.relpath(cat, BP_ROOT), "items": items}, f, indent=0)
    with open(os.path.join(OUT, "vanilla_loot_tables.json"), "w") as f:
        json.dump(loot_paths(), f, indent=0)
    print(f"{len(items)} items from {os.path.relpath(cat, BP_ROOT)}")


if __name__ == "__main__":
    main()
