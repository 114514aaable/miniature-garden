#!/usr/bin/env python3
"""世界包校验器：JSON Schema + 跨文件引用完整性。

用法：
    python tools/validate/validate.py worlds/official examples/minimal-world
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Windows 控制台默认 GBK，输出中文与 ✓/✗ 会直接抛 UnicodeEncodeError。
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:  # pragma: no cover
    print("缺少依赖：pip install jsonschema", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "spec" / "schema"

SCHEMAS = {
    "manifest": "manifest.schema.json",
    "regions": "region.schema.json",
    "entities": "entity.schema.json",
    "knowledge": "knowledge.schema.json",
}


class PackError(Exception):
    """世界包目录本身有问题（读不到、路径越界等）。"""


def load_json(path: Path) -> object:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise PackError(f"文件不存在：{path}")
    except json.JSONDecodeError as exc:
        raise PackError(f"JSON 解析失败：{path}:{exc.lineno}:{exc.colno} {exc.msg}")


def schema_validator(name: str) -> Draft202012Validator:
    schema = load_json(SCHEMA_DIR / SCHEMAS[name])
    return Draft202012Validator(schema, format_checker=FormatChecker())


def schema_errors(name: str, document: object, rel: Path) -> list[str]:
    validator = schema_validator(name)
    errors = []
    for err in sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path)):
        where = "/".join(str(p) for p in err.absolute_path) or "<根>"
        errors.append(f"{rel}: {where}: {err.message}")
    return errors


def resolve(pack_dir: Path, rel: str) -> Path:
    target = (pack_dir / rel).resolve()
    try:
        target.relative_to(pack_dir.resolve())
    except ValueError:
        raise PackError(f"文件路径越出世界包目录：{rel}")
    return target


def validate_pack(pack_dir: Path) -> tuple[int, int, int, list[str]]:
    errors: list[str] = []

    manifest = load_json(pack_dir / "manifest.json")
    errors += schema_errors("manifest", manifest, Path("manifest.json"))

    files = manifest.get("files", {}) if isinstance(manifest, dict) else {}
    regions_doc = load_json(resolve(pack_dir, files.get("regions", "regions.json")))
    entities_doc = load_json(resolve(pack_dir, files.get("entities", "entities.json")))
    knowledge_doc = load_json(resolve(pack_dir, files.get("knowledge", "knowledge.json")))

    errors += schema_errors("regions", regions_doc, Path("regions.json"))
    errors += schema_errors("entities", entities_doc, Path("entities.json"))
    errors += schema_errors("knowledge", knowledge_doc, Path("knowledge.json"))

    regions = regions_doc.get("regions", [])
    entities = entities_doc.get("entities", [])
    entries = knowledge_doc.get("knowledge", [])

    region_ids = {r["id"] for r in regions}
    entity_by_id = {e["id"] for e in entities}
    entries_by_id = {k["id"] for k in entries}

    # ---- 全局 id 唯一 ----
    seen: dict[str, str] = {}
    for kind, items in (("region", regions), ("entity", entities), ("knowledge", entries)):
        for item in items:
            ident = item.get("id")
            if ident in seen:
                errors.append(f"id 重复：{ident}（{seen[ident]} 与 {kind}）")
            else:
                seen[ident] = kind

    # ---- 区域 ----
    for region in regions:
        parent = region.get("parent")
        if parent is not None and parent not in region_ids:
            errors.append(f"regions.json: {region['id']}.parent 指向不存在的区域 {parent}")

    # ---- 实体 ----
    location_kind = {e["id"]: e["kind"] for e in entities}
    for entity in entities:
        eid = entity["id"]
        region = entity.get("region")
        if region is not None and region not in region_ids:
            errors.append(f"entities.json: {eid}.region 指向不存在的区域 {region}")

        location = entity.get("location")
        if location:
            for target in location.get("exits", []):
                if location_kind.get(target) != "location":
                    errors.append(f"entities.json: {eid}.exits 指向不存在的 location {target}")
                    continue
                back = next(
                    (e for e in entities if e["id"] == target), {}
                ).get("location", {}).get("exits", [])
                if eid not in back:
                    errors.append(f"entities.json: exits 不双向：{eid} -> {target}")

        faction_block = entity.get("faction")
        if faction_block:
            for seat in faction_block.get("seats", []):
                if seat not in region_ids:
                    errors.append(f"entities.json: {eid}.seats 指向不存在的区域 {seat}")

        npc = entity.get("npc")
        if npc:
            faction_ref = npc.get("faction")
            if faction_ref is not None:
                if not any(e["id"] == faction_ref and e["kind"] == "faction" for e in entities):
                    errors.append(f"entities.json: {eid}.npc.faction 指向不存在的势力 {faction_ref}")
            for kid in npc.get("knowledge", []):
                if kid not in entries_by_id:
                    errors.append(f"entities.json: {eid}.npc.knowledge 指向不存在的条目 {kid}")

    for region in regions:
        for fid in region.get("factions", []):
            if location_kind.get(fid) != "faction":
                errors.append(f"regions.json: {region['id']}.factions 指向不存在的势力 {fid}")

    # ---- 知识 ----
    for entry in entries:
        for rid in entry.get("regions", []):
            if rid not in region_ids:
                errors.append(f"knowledge.json: {entry['id']}.regions 指向不存在的区域 {rid}")
        for fid in entry.get("factions", []):
            if location_kind.get(fid) != "faction":
                errors.append(f"knowledge.json: {entry['id']}.factions 指向不存在的势力 {fid}")
        for hid in entry.get("holders", []):
            if location_kind.get(hid) != "npc":
                errors.append(f"knowledge.json: {entry['id']}.holders 指向不存在的 NPC {hid}")
        for ref in entry.get("refs", []):
            if ref not in seen:
                errors.append(f"knowledge.json: {entry['id']}.refs 指向不存在的对象 {ref}")

    # ---- 出生点 ----
    start = manifest.get("start", {}) if isinstance(manifest, dict) else {}
    if start.get("region") not in region_ids:
        errors.append(f"manifest.json: start.region 指向不存在的区域 {start.get('region')}")
    spawn = start.get("spawn")
    if spawn is not None and location_kind.get(spawn) != "location":
        errors.append(f"manifest.json: start.spawn 指向不存在的 location {spawn}")

    return len(regions), len(entities), len(entries), errors


def main() -> int:
    parser = argparse.ArgumentParser(description="校验世界包")
    parser.add_argument("packs", nargs="+", help="世界包目录")
    args = parser.parse_args()

    failed = False
    for raw in args.packs:
        pack_dir = Path(raw)
        if not (pack_dir / "manifest.json").is_file():
            print(f"✗ {raw}: 不是世界包目录（缺少 manifest.json）")
            failed = True
            continue
        try:
            n_regions, n_entities, n_knowledge, errors = validate_pack(pack_dir)
        except PackError as exc:
            print(f"✗ {raw}: {exc}")
            failed = True
            continue

        if errors:
            failed = True
            print(f"✗ {raw}: {len(errors)} 个问题")
            for message in errors:
                print(f"    - {message}")
        else:
            print(
                f"✓ {raw}: {n_regions} 个区域 / {n_entities} 个实体 / {n_knowledge} 条知识"
            )

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
