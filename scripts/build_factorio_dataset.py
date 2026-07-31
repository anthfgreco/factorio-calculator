#!/usr/bin/env python3
"""Build a Kirk McDonald calculator dataset from official Factorio exports.

Expected input is the directory produced by Factorio's built-in commands:

    --dump-data
    --dump-prototype-locale
    --dump-icon-sprites

The script consumes data-raw-dump.json, the *-locale.json files, and the
rendered prototype icons. It writes a calculator JSON dataset and a 32 px
sprite sheet.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

CELL_SIZE = 32
TARGET_VERSION = "2.1.12"
DATASET_NAME = f"space-age-{TARGET_VERSION}.json"
EXPECTED_MODS = ["base", "elevated-rails", "quality", "recycler", "space-age"]

ASTEROID_CHUNK_KEYS = {
    "carbonic-asteroid-chunk",
    "metallic-asteroid-chunk",
    "oxide-asteroid-chunk",
    "promethium-asteroid-chunk",
}

# These are all item-like prototype families present in the 2.1.12 dump.
# Fluids and asteroid chunks are included separately because they are not
# represented by stack_size in the same way as conventional items.
ITEM_TYPES = (
    "ammo",
    "armor",
    "blueprint",
    "blueprint-book",
    "capsule",
    "copy-paste-tool",
    "deconstruction-item",
    "gun",
    "item",
    "item-with-entity-data",
    "module",
    "rail-planner",
    "repair-tool",
    "selection-tool",
    "space-platform-starter-pack",
    "spidertron-remote",
    "tool",
    "upgrade-item",
    "asteroid-chunk",
)

RECIPE_ALIASES = {
    # Factorio 2.1 recipe ID renames.
    "molten-copper": "copper-ore-melting",
    "molten-iron": "iron-ore-melting",
    "wood-processing": "tree-seed",
}

POWER_FACTORS = {
    "": 1,
    "k": 1_000,
    "K": 1_000,
    "M": 1_000_000,
    "G": 1_000_000_000,
    "T": 1_000_000_000_000,
}
POWER_RE = re.compile(
    r"^\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*([kKMGT]?)\s*[WJ]\s*$"
)
VERSION_RE = re.compile(r"\bVersion:\s*(\d+\.\d+\.\d+)\s*\(build\s+(\d+)")


@dataclass(frozen=True)
class IconRef:
    context: str
    key: str


class ExportError(RuntimeError):
    pass


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, value: Any) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=4, sort_keys=True)
        file.write("\n")


def normalize_allowed_effects(value: Any) -> list[str] | None:
    """Normalize Factorio's array-or-set-like allowed_effects export.

    Factorio's raw dump can represent an omitted/default limitation as an
    empty object. Preserve that as None (all effects allowed), while keeping an
    explicit empty array as [] (no effects allowed).
    """
    if isinstance(value, list):
        return [str(effect) for effect in value]
    if isinstance(value, dict):
        if not value:
            return None
        return [str(effect) for effect, enabled in value.items() if enabled]
    return None


def convert_power(value: Any) -> float | int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    match = POWER_RE.match(value)
    if not match:
        raise ExportError(f"Unsupported energy value: {value!r}")
    result = float(match.group(1)) * POWER_FACTORS[match.group(2)]
    return int(result) if result.is_integer() else result


def extract_version(version_file: Path) -> tuple[str, int | None]:
    text = version_file.read_text(encoding="utf-8", errors="replace")
    match = VERSION_RE.search(text)
    if not match:
        raise ExportError(f"Could not identify Factorio version in {version_file}")
    return match.group(1), int(match.group(2))


def expected_result_amount(result: dict[str, Any]) -> float:
    if "amount" in result:
        amount = float(result["amount"])
    elif "amount_min" in result or "amount_max" in result:
        minimum = float(result.get("amount_min", result["amount_max"]))
        maximum = float(result.get("amount_max", result["amount_min"]))
        amount = (minimum + maximum) / 2
    else:
        amount = 1.0

    amount += float(result.get("extra_count_fraction", 0))

    if "independent_probability" in result:
        amount *= float(result["independent_probability"])
    elif "shared_probability" in result:
        probability = result["shared_probability"]
        amount *= float(probability.get("max", 1)) - float(probability.get("min", 0))
    elif "probability" in result:
        amount *= float(result["probability"])
    return amount


def normalize_product(product: Any) -> dict[str, Any]:
    if isinstance(product, list):
        return {"name": product[0], "amount": product[1]}
    result: dict[str, Any] = {"name": product["name"]}
    for field in (
        "amount",
        "amount_min",
        "amount_max",
        "probability",
        "independent_probability",
        "shared_probability",
        "extra_count_fraction",
        "ignored_by_productivity",
    ):
        if field in product:
            result[field] = product[field]
    if not any(field in result for field in ("amount", "amount_min", "amount_max")):
        result["amount"] = 1
    return result


def normalize_ingredient(ingredient: Any) -> dict[str, Any]:
    if isinstance(ingredient, list):
        return {"name": ingredient[0], "amount": ingredient[1]}
    return {"name": ingredient["name"], "amount": ingredient.get("amount", 1)}


def normalize_sequence(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        # Empty tables are emitted as JSON objects by Factorio.
        if not value:
            return []
        return list(value.values())
    raise ExportError(f"Expected array-like prototype field, got {type(value).__name__}")


def make_conditions(raw: dict[str, Any]) -> list[dict[str, Any]] | None:
    conditions = raw.get("surface_conditions")
    if not conditions:
        return None
    return [
        {
            "property": condition["property"],
            "min": condition.get("min"),
            "max": condition.get("max"),
        }
        for condition in conditions
    ]


def make_energy_source(raw: dict[str, Any]) -> dict[str, Any] | None:
    source = raw.get("energy_source")
    if not source:
        return None
    categories = source.get("fuel_categories")
    category = categories[0] if categories else source.get("fuel_category")
    emissions = source.get("emissions_per_minute")
    if isinstance(emissions, (int, float)):
        emissions = {"pollution": emissions}
    return {
        "type": source.get("type"),
        "fuel_category": category,
        "emissions_per_minute": emissions,
    }


def clean_none(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: clean_none(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [clean_none(item) for item in value]
    return value


class LocaleIndex:
    def __init__(self, dump_dir: Path):
        self.names: dict[str, dict[str, str]] = {}
        for path in dump_dir.glob("*-locale.json"):
            data = load_json(path)
            self.names[path.name.removesuffix("-locale.json")] = data.get("names", {})

    def get(self, key: str, *sections: str) -> str:
        for section in sections:
            value = self.names.get(section, {}).get(key)
            if value:
                return value
        # The official locale dump should normally resolve every visible
        # prototype. Hidden test prototypes still need stable calculator text.
        return key.replace("-", " ").capitalize()


class SpriteBuilder:
    def __init__(self, dump_dir: Path, old_data: Path, old_images_dir: Path):
        self.dump_dir = dump_dir
        self.old_data = old_data
        self.old_images_dir = old_images_dir
        self._images: dict[str, Image.Image] = {}
        self._objects: list[tuple[dict[str, Any], IconRef]] = []
        self._special: dict[str, tuple[str, Image.Image]] = {}

    def register(self, target: dict[str, Any], context: str, key: str) -> None:
        self._objects.append((target, IconRef(context, key)))

    def _find_icon(self, ref: IconRef) -> Path:
        candidates: list[Path]
        if ref.context == "item":
            candidates = [self.dump_dir / "item" / f"{ref.key}.png"]
        elif ref.context == "fluid":
            candidates = [self.dump_dir / "fluid" / f"{ref.key}.png"]
        elif ref.context == "recipe":
            candidates = [self.dump_dir / "recipe" / f"{ref.key}.png"]
        elif ref.context == "entity":
            candidates = [
                self.dump_dir / "entity" / f"{ref.key}.png",
                self.dump_dir / "item" / f"{ref.key}.png",
            ]
        elif ref.context == "planet":
            candidates = [
                self.dump_dir / "space-location" / f"{ref.key}.png",
                self.dump_dir / "surface" / f"{ref.key}.png",
            ]
        else:
            raise ExportError(f"Unknown icon context: {ref.context}")

        for path in candidates:
            if path.exists():
                return path
        raise ExportError(f"Missing exported icon for {ref.context}/{ref.key}")

    @staticmethod
    def _resize(path: Path) -> Image.Image:
        with Image.open(path) as source:
            return source.convert("RGBA").resize((CELL_SIZE, CELL_SIZE), Image.Resampling.LANCZOS)

    @staticmethod
    def _image_key(image: Image.Image) -> str:
        return hashlib.sha256(image.tobytes()).hexdigest()

    def _load_clock(self) -> Image.Image:
        old = load_json(self.old_data)
        sprite = old["sprites"]
        sheet_path = self.old_images_dir / f"sprite-sheet-{sprite['hash']}.png"
        clock = sprite["extra"]["clock"]
        left = clock["icon_col"] * CELL_SIZE
        top = clock["icon_row"] * CELL_SIZE
        with Image.open(sheet_path) as sheet:
            return sheet.convert("RGBA").crop((left, top, left + CELL_SIZE, top + CELL_SIZE))

    def build(self, output_images_dir: Path) -> dict[str, Any]:
        # Rendered Factorio icon exports already include icon composition,
        # tinting, scale, and shifts. Deduplicate by final pixel content.
        for _, ref in self._objects:
            path = self._find_icon(ref)
            image = self._resize(path)
            self._images.setdefault(self._image_key(image), image)

        no_module_path = self.dump_dir / "item" / "empty-module-slot.png"
        no_module = self._resize(no_module_path)
        clock = self._load_clock()
        self._special = {
            "slot_icon_module": ("no module", no_module),
            "clock": ("time", clock),
        }
        for _, image in self._special.values():
            self._images.setdefault(self._image_key(image), image)

        ordered_keys = sorted(self._images)
        width_cells = max(1, math.floor(math.sqrt(len(ordered_keys))))
        height_cells = math.ceil(len(ordered_keys) / width_cells)
        sheet = Image.new("RGBA", (width_cells * CELL_SIZE, height_cells * CELL_SIZE))
        coordinates: dict[str, tuple[int, int]] = {}
        for index, image_key in enumerate(ordered_keys):
            row, column = divmod(index, width_cells)
            sheet.alpha_composite(self._images[image_key], dest=(column * CELL_SIZE, row * CELL_SIZE))
            coordinates[image_key] = (column, row)

        for target, ref in self._objects:
            image = self._resize(self._find_icon(ref))
            column, row = coordinates[self._image_key(image)]
            target["icon_col"] = column
            target["icon_row"] = row

        extras: dict[str, Any] = {}
        for key, (name, image) in self._special.items():
            column, row = coordinates[self._image_key(image)]
            extras[key] = {"name": name, "icon_col": column, "icon_row": row}

        # Keep the historic calculator convention of hashing the PNG bytes.
        temp_path = output_images_dir / ".sprite-sheet.tmp.png"
        output_images_dir.mkdir(parents=True, exist_ok=True)
        sheet.save(temp_path, format="PNG", optimize=True)
        digest = hashlib.md5(temp_path.read_bytes()).hexdigest()
        output_path = output_images_dir / f"sprite-sheet-{digest}.png"
        if output_path.exists():
            output_path.unlink()
        temp_path.replace(output_path)

        return {
            "hash": digest,
            "width": sheet.width,
            "height": sheet.height,
            "extra": extras,
        }


class DatasetBuilder:
    def __init__(self, dump_dir: Path, old_data: Path, images_dir: Path):
        self.dump_dir = dump_dir
        self.raw = load_json(dump_dir / "data-raw-dump.json")
        self.locale = LocaleIndex(dump_dir)
        self.sprite = SpriteBuilder(dump_dir, old_data, images_dir)
        self.item_map: dict[str, dict[str, Any]] = {}
        self.seed_map: dict[str, str] = {}

    def _item_name(self, key: str) -> str:
        return self.locale.get(key, "item", "fluid", "asteroid-chunk", "equipment", "entity")

    def _entity_name(self, key: str) -> str:
        return self.locale.get(key, "entity", "item", "equipment")

    def _recipe_name(self, key: str, main_product: str | None) -> str:
        if key in self.locale.names.get("recipe", {}):
            return self.locale.get(key, "recipe")
        if main_product:
            return self._item_name(main_product)
        return key.replace("-", " ").capitalize()

    def build_groups(self) -> dict[str, Any]:
        groups = {
            key: {"order": value.get("order"), "subgroups": {}}
            for key, value in self.raw["item-group"].items()
        }
        for key, subgroup in self.raw["item-subgroup"].items():
            group = subgroup["group"]
            if group in groups:
                groups[group]["subgroups"][key] = subgroup.get("order")
        return groups

    def build_items(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        items: list[dict[str, Any]] = []
        fuel: list[dict[str, Any]] = []
        spoilage: list[dict[str, Any]] = []
        subgroups = self.raw["item-subgroup"]

        prototypes: dict[str, dict[str, Any]] = {}
        for prototype_type in ITEM_TYPES:
            for key, raw in self.raw.get(prototype_type, {}).items():
                if key.startswith("parameter-") or key.endswith("-unknown"):
                    continue
                # Prefer conventional item prototypes when a hidden utility
                # appears in multiple prototype families.
                prototypes.setdefault(key, raw)

        for key, raw in self.raw["fluid"].items():
            if key.startswith("parameter-") or key.endswith("-unknown"):
                continue
            prototypes[key] = raw

        for key in sorted(prototypes):
            raw = prototypes[key]
            subgroup = raw.get("subgroup", "other")
            if subgroup not in subgroups:
                subgroup = "other"
            order = raw.get("order")
            if order is None:
                # Some valid 2.1 items inherit their display ordering from the
                # entity they place (notably space-platform-hub). Keep those
                # items because generated recycling recipes reference them.
                placed_entity = raw.get("place_result")
                if placed_entity:
                    for section in self.raw.values():
                        if not isinstance(section, dict):
                            continue
                        entity = section.get(placed_entity)
                        if isinstance(entity, dict) and entity.get("order") is not None:
                            order = entity["order"]
                            break
                if order is None:
                    # Hidden unknown/debug sentinels are intentionally omitted.
                    continue
            item = clean_none({
                "key": key,
                "localized_name": {"en": self._item_name(key)},
                "order": order,
                "stack_size": raw.get("stack_size"),
                "subgroup": subgroup,
                "group": subgroups[subgroup]["group"],
                "type": "fluid" if raw.get("type") == "fluid" else raw.get("type", "item"),
            })
            self.sprite.register(item, "fluid" if item["type"] == "fluid" else "item", key)
            items.append(item)
            self.item_map[key] = item

            if raw.get("fuel_value") is not None and raw.get("fuel_category") is not None:
                fuel.append({
                    "item_key": key,
                    "category": raw["fuel_category"],
                    "value": convert_power(raw["fuel_value"]),
                })
            if raw.get("spoil_result") is not None:
                spoilage.append({
                    "from_item": key,
                    "to_item": raw["spoil_result"],
                    "time": raw["spoil_ticks"],
                })
            if raw.get("plant_result") is not None:
                self.seed_map[raw["plant_result"]] = key

        items.sort(key=lambda item: (item["order"], item["key"]))
        fuel.sort(key=lambda item: item["item_key"])
        spoilage.sort(key=lambda item: item["from_item"])
        return items, fuel, spoilage

    def build_fluids(self) -> list[dict[str, Any]]:
        fluids = []
        for key, raw in sorted(self.raw["fluid"].items()):
            if key.startswith("parameter-") or key.endswith("-unknown"):
                continue
            fluids.append(clean_none({
                "item_key": key,
                "default_temperature": raw.get("default_temperature"),
                "max_temperature": raw.get("max_temperature"),
                "heat_capacity": convert_power(raw.get("heat_capacity")),
                "fuel_value": convert_power(raw.get("fuel_value")),
            }))
        return fluids

    def build_modules(self) -> list[dict[str, Any]]:
        modules = []
        for key, raw in sorted(self.raw["module"].items()):
            effect = raw.get("effect", {})
            modules.append({
                "item_key": key,
                "category": raw.get("category"),
                # The calculator models only production-rate effects.
                "effect": clean_none({
                    "consumption": effect.get("consumption"),
                    "pollution": effect.get("pollution"),
                    "productivity": effect.get("productivity"),
                    "quality": effect.get("quality"),
                    "speed": effect.get("speed"),
                }),
            })
        return modules

    def build_belts(self) -> list[dict[str, Any]]:
        belts = []
        for key, raw in sorted(self.raw["transport-belt"].items()):
            belt = {
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "speed": raw["speed"],
            }
            self.sprite.register(belt, "entity", key)
            belts.append(belt)
        return belts

    def build_crafting_machines(self) -> list[dict[str, Any]]:
        machines = []
        for section in ("assembling-machine", "furnace"):
            for key, raw in sorted(self.raw[section].items()):
                base_effect = raw.get("effect_receiver", {}).get("base_effect", {})
                machine = clean_none({
                    "key": key,
                    "localized_name": {"en": self._entity_name(key)},
                    "allowed_effects": normalize_allowed_effects(raw.get("allowed_effects")),
                    "crafting_categories": raw.get("crafting_categories", []),
                    "crafting_speed": raw.get("crafting_speed"),
                    "energy_source": make_energy_source(raw),
                    "energy_usage": convert_power(raw.get("energy_usage")),
                    "module_slots": raw.get("module_slots", 0),
                    "prod_bonus": base_effect.get("productivity", 0),
                    "surface_conditions": make_conditions(raw),
                })
                self.sprite.register(machine, "entity", key)
                machines.append(machine)
        return machines

    def build_mining_drills(self) -> list[dict[str, Any]]:
        drills = []
        for key, raw in sorted(self.raw["mining-drill"].items()):
            drill = clean_none({
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "allowed_effects": normalize_allowed_effects(raw.get("allowed_effects")),
                "energy_source": make_energy_source(raw),
                "energy_usage": convert_power(raw.get("energy_usage")),
                "mining_speed": raw.get("mining_speed"),
                "module_slots": raw.get("module_slots", 0),
                "resource_categories": raw.get("resource_categories", []),
                "takes_fluid": raw.get("input_fluid_box") is not None,
                "surface_conditions": make_conditions(raw),
            })
            self.sprite.register(drill, "entity", key)
            drills.append(drill)
        return drills

    def build_rocket_silo(self) -> list[dict[str, Any]]:
        silos = []
        for key, raw in sorted(self.raw["rocket-silo"].items()):
            silo = clean_none({
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "allowed_effects": normalize_allowed_effects(raw.get("allowed_effects")),
                "crafting_categories": raw.get("crafting_categories", []),
                "crafting_speed": raw.get("crafting_speed"),
                "energy_usage": convert_power(raw.get("energy_usage")),
                "module_slots": raw.get("module_slots", 0),
                "surface_conditions": make_conditions(raw),
            })
            self.sprite.register(silo, "entity", key)
            silos.append(silo)
        return silos

    def build_resources(self) -> list[dict[str, Any]]:
        resources = []
        for key, raw in sorted(self.raw["resource"].items()):
            minable = raw["minable"]
            products = normalize_sequence(minable.get("results"))
            if minable.get("result") is not None:
                products = [{"name": minable["result"], "amount": 1}]
            resource = clean_none({
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "category": raw.get("category"),
                "fluid_amount": minable.get("fluid_amount"),
                "mining_time": minable.get("mining_time"),
                "required_fluid": minable.get("required_fluid"),
                "results": [normalize_product(product) for product in products],
            })
            self.sprite.register(resource, "entity", key)
            resources.append(resource)
        return resources

    def build_boilers(self) -> list[dict[str, Any]]:
        boilers = []
        for key, raw in sorted(self.raw["boiler"].items()):
            boiler = clean_none({
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "energy_consumption": convert_power(raw.get("energy_consumption")),
                "energy_source": make_energy_source(raw),
                "target_temperature": raw.get("target_temperature"),
            })
            self.sprite.register(boiler, "entity", key)
            boilers.append(boiler)
        return boilers

    def build_offshore_pumps(self) -> list[dict[str, Any]]:
        pumps = []
        for key, raw in sorted(self.raw["offshore-pump"].items()):
            pump = {
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "pumping_speed": raw.get("pumping_speed"),
                "surface_conditions": make_conditions(raw),
            }
            self.sprite.register(pump, "entity", key)
            pumps.append(pump)
        return pumps

    def build_agricultural_towers(self) -> list[dict[str, Any]]:
        towers = []
        for key, raw in sorted(self.raw["agricultural-tower"].items()):
            tower = clean_none({
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "energy_source": make_energy_source(raw),
                "energy_usage": convert_power(raw.get("energy_usage")),
            })
            self.sprite.register(tower, "entity", key)
            towers.append(tower)
        return towers

    def build_plants(self) -> tuple[list[dict[str, Any]], dict[str, set[str]]]:
        plants = []
        controls: dict[str, set[str]] = {}
        for key, raw in sorted(self.raw.get("plant", {}).items()):
            minable = raw.get("minable", {})
            plant = clean_none({
                "key": key,
                "localized_name": {"en": self._entity_name(key)},
                "order": raw.get("order"),
                "growth_ticks": raw.get("growth_ticks"),
                "results": [
                    normalize_product(product)
                    for product in normalize_sequence(minable.get("results"))
                ],
                "seed": self.seed_map.get(key),
                "surface_conditions": make_conditions(raw),
            })
            if not plant.get("seed"):
                raise ExportError(f"Plant {key} has no seed item")
            self.sprite.register(plant, "entity", key)
            plants.append(plant)
            control = raw.get("autoplace", {}).get("control")
            if control:
                controls.setdefault(control, set()).add(key)
        return plants, controls

    def build_surface_properties(self) -> list[dict[str, Any]]:
        return [
            {"name": key, "default_value": raw.get("default_value")}
            for key, raw in sorted(self.raw.get("surface-property", {}).items())
        ]

    def build_planets(
        self,
        plant_controls: dict[str, set[str]],
    ) -> list[dict[str, Any]]:
        resource_keys = set(self.raw["resource"])
        tile_fluids = {
            key: raw["fluid"]
            for key, raw in self.raw["tile"].items()
            if raw.get("fluid")
        }
        planets = []
        for section in ("planet", "surface"):
            for key, raw in sorted(self.raw.get(section, {}).items()):
                map_gen = raw.get("map_gen_settings") or {}
                controls = map_gen.get("autoplace_controls") or {}
                plant_keys: set[str] = set()
                for control in controls:
                    plant_keys.update(plant_controls.get(control, set()))

                settings = map_gen.get("autoplace_settings") or {}
                entity_settings = (settings.get("entity") or {}).get("settings") or {}
                tile_settings = (settings.get("tile") or {}).get("settings") or {}
                local_resources = {key for key in entity_settings if key in resource_keys}
                # Asteroid chunks are collected around Space platforms rather
                # than generated by map autoplace settings, so the official
                # surface prototype does not list them as local resources.
                if key == "space-platform":
                    local_resources.update(ASTEROID_CHUNK_KEYS)
                offshore = sorted({tile_fluids[key] for key in tile_settings if key in tile_fluids})

                planet = clean_none({
                    "key": key,
                    "localized_name": {
                        "en": self.locale.get(key, "space-location", "surface")
                    },
                    "order": raw.get("order"),
                    "resources": {
                        "resource": sorted(local_resources),
                        "offshore": offshore,
                        "plants": sorted(plant_keys),
                    },
                    "surface_properties": raw.get("surface_properties", {}),
                })
                self.sprite.register(planet, "planet", key)
                planets.append(planet)
        return planets

    def build_recipe(self, key: str, raw: dict[str, Any]) -> dict[str, Any] | None:
        if key.startswith("parameter-"):
            return None
        results = [normalize_product(product) for product in normalize_sequence(raw.get("results"))]
        if raw.get("result") is not None:
            results = [{"name": raw["result"], "amount": raw.get("result_count", 1)}]

        main_product = raw.get("main_product") or None
        if main_product is None and len(results) == 1:
            main_product = results[0]["name"]
        main_item = self.item_map.get(main_product) if main_product else None

        subgroup = raw.get("subgroup") or (main_item.get("subgroup") if main_item else None)
        order = raw.get("order") or (main_item.get("order") if main_item else None)

        # Factorio 2.1's generated recycling recipes often omit subgroup/order.
        # Their first ingredient is the recycled item, so inherit display
        # metadata from that item rather than dropping the recipe.
        ingredients = [
            normalize_ingredient(ingredient)
            for ingredient in normalize_sequence(raw.get("ingredients"))
        ]
        if (subgroup is None or order is None) and key.endswith("-recycling") and ingredients:
            recycled_item = self.item_map.get(ingredients[0]["name"])
            if recycled_item:
                subgroup = subgroup or recycled_item.get("subgroup")
                order = order or recycled_item.get("order")

        if subgroup in {"fill-barrel", "empty-barrel"}:
            return None
        if subgroup is None:
            # Unknown/debug-only recipes have no meaningful display group.
            return None
        if order is None:
            order = f"z[generated]-{key}"

        categories = raw.get("categories")
        if categories is None:
            legacy = raw.get("category")
            categories = [legacy] if legacy else ["crafting"]
        elif isinstance(categories, str):
            categories = [categories]

        recipe = clean_none({
            "key": key,
            "localized_name": {"en": self._recipe_name(key, main_product)},
            "allow_productivity": bool(raw.get("allow_productivity", False)),
            "allow_quality": bool(raw.get("allow_quality", True)),
            "categories": categories,
            "energy_required": raw.get("energy_required", 0.5),
            "ingredients": ingredients,
            "results": results,
            "order": order,
            "subgroup": subgroup,
            "surface_conditions": make_conditions(raw),
        })
        self.sprite.register(recipe, "recipe", key)
        return recipe

    def build_recipes(self) -> list[dict[str, Any]]:
        recipes = []
        for key, raw in sorted(self.raw["recipe"].items()):
            recipe = self.build_recipe(key, raw)
            if recipe is not None:
                recipes.append(recipe)
        return recipes

    def build(self, version: str, build_number: int | None, images_dir: Path) -> dict[str, Any]:
        groups = self.build_groups()
        items, fuel, spoilage = self.build_items()
        fluids = self.build_fluids()
        modules = self.build_modules()
        belts = self.build_belts()
        crafters = self.build_crafting_machines()
        drills = self.build_mining_drills()
        silos = self.build_rocket_silo()
        resources = self.build_resources()
        boilers = self.build_boilers()
        pumps = self.build_offshore_pumps()
        towers = self.build_agricultural_towers()
        plants, plant_controls = self.build_plants()
        properties = self.build_surface_properties()
        planets = self.build_planets(plant_controls)
        recipes = self.build_recipes()

        beacon = self.raw["beacon"]["beacon"]
        dataset = {
            "game_version": version,
            "game_build": build_number,
            "experimental": True,
            "source": "Factorio built-in prototype, locale, and icon exports",
            "recipe_aliases": RECIPE_ALIASES,
            "groups": groups,
            "items": items,
            "fluids": fluids,
            "fuel": fuel,
            "spoilage": spoilage,
            "belts": belts,
            "modules": modules,
            "resources": resources,
            "plants": plants,
            "boilers": boilers,
            "offshore_pumps": pumps,
            "agricultural_tower": towers,
            "crafting_machines": crafters,
            "mining_drills": drills,
            "rocket_silo": silos,
            "surface_properties": properties,
            "planets": planets,
            "recipes": recipes,
            "beacon": {
                "allowed_effects": normalize_allowed_effects(beacon.get("allowed_effects")),
                "distribution_effectivity": beacon.get("distribution_effectivity"),
                "energy_usage": convert_power(beacon.get("energy_usage")),
                "profile": beacon.get("profile"),
            },
        }
        # SpriteBuilder mutates the registered dataset objects with icon
        # coordinates. Clean the dataset only after those mutations have been
        # applied; cleaning earlier creates detached copies and drops every
        # icon_col/icon_row field.
        dataset["sprites"] = self.sprite.build(images_dir)
        return clean_none(dataset)


def validate_dataset(dataset: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    item_keys = {item["key"] for item in dataset["items"]}
    recipe_map = {recipe["key"]: recipe for recipe in dataset["recipes"]}

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    require(dataset["game_version"] == TARGET_VERSION, "Unexpected game version")
    require("iron-ore-melting" in recipe_map, "Missing iron-ore-melting")
    require("copper-ore-melting" in recipe_map, "Missing copper-ore-melting")
    require("tree-seed" in recipe_map, "Missing tree-seed")
    require("wood-processing" not in recipe_map, "Removed wood-processing still present")
    require("copy-paste-tool-recycling" not in recipe_map, "Removed copy-paste-tool recycling still present")
    require("cut-paste-tool-recycling" not in recipe_map, "Removed cut-paste-tool recycling still present")

    for recipe in dataset["recipes"]:
        require(bool(recipe["categories"]), f"Recipe {recipe['key']} has no categories")
        for entry in recipe["ingredients"] + recipe["results"]:
            require(entry["name"] in item_keys, f"Recipe {recipe['key']} references missing item {entry['name']}")
        for result in recipe["results"]:
            require(expected_result_amount(result) >= 0, f"Recipe {recipe['key']} has negative expected output")

    machine_categories = set()
    for machine in dataset["crafting_machines"] + dataset["rocket_silo"]:
        machine_categories.update(machine["crafting_categories"])
    for recipe in dataset["recipes"]:
        require(
            bool(set(recipe["categories"]) & machine_categories),
            f"Recipe {recipe['key']} has no compatible machine category: {recipe['categories']}",
        )

    piercing = recipe_map.get("piercing-shotgun-shell", {})
    require(piercing.get("results") == [{"name": "piercing-shotgun-shell", "amount": 2}], "Piercing shells mismatch")
    acid = recipe_map.get("acid-neutralisation", {})
    require(acid.get("energy_required") == 0.5, "Acid neutralisation time mismatch")
    require(
        {entry["name"]: entry["amount"] for entry in acid.get("ingredients", [])}.get("sulfuric-acid") == 100,
        "Acid neutralisation sulfuric acid mismatch",
    )
    space_platform = next((planet for planet in dataset["planets"] if planet["key"] == "space-platform"), None)
    require(space_platform is not None, "Missing Space platform")
    if space_platform is not None:
        platform_resources = set(space_platform["resources"]["resource"])
        require(
            ASTEROID_CHUNK_KEYS <= platform_resources,
            "Space platform is missing asteroid chunk resources",
        )

    metallic = recipe_map.get("metallic-asteroid-crushing", {})
    chunk = next((item for item in metallic.get("results", []) if item["name"] == "metallic-asteroid-chunk"), None)
    require(chunk is not None and chunk.get("independent_probability") == 0.3, "Asteroid crushing probability mismatch")

    raw_non_parameter = {
        key
        for key, recipe in raw["recipe"].items()
        if not key.startswith("parameter-") and recipe.get("subgroup") not in {"fill-barrel", "empty-barrel"}
    }
    excluded_raw = sorted(raw_non_parameter - set(recipe_map))
    require(excluded_raw == ["item-unknown-recycling", "recipe-unknown"], f"Unexpected excluded raw recipes: {excluded_raw}")

    icon_sections = (
        "items",
        "belts",
        "crafting_machines",
        "mining_drills",
        "resources",
        "rocket_silo",
        "boilers",
        "offshore_pumps",
        "agricultural_tower",
        "plants",
        "planets",
        "recipes",
    )
    for section in icon_sections:
        for entry in dataset[section]:
            require(
                isinstance(entry.get("icon_col"), int) and isinstance(entry.get("icon_row"), int),
                f"{section}/{entry.get('key')} is missing sprite coordinates",
            )

    if errors:
        raise ExportError("Dataset validation failed:\n- " + "\n- ".join(errors[:100]))

    return {
        "items": len(dataset["items"]),
        "recipes": len(dataset["recipes"]),
        "crafting_machines": len(dataset["crafting_machines"]),
        "resources": len(dataset["resources"]),
        "plants": len(dataset["plants"]),
        "planets": len(dataset["planets"]),
        "sprite_width": dataset["sprites"]["width"],
        "sprite_height": dataset["sprites"]["height"],
        "sprite_hash": dataset["sprites"]["hash"],
        "excluded_raw_recipes": excluded_raw,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dump_dir", type=Path, help="Extracted Factorio export directory")
    parser.add_argument("--calculator-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    dump_dir = args.dump_dir.resolve()
    calculator_dir = args.calculator_dir.resolve()
    output = args.output or calculator_dir / "public" / "data" / DATASET_NAME
    report = args.report or calculator_dir / "build-reports" / f"space-age-{TARGET_VERSION}.json"
    old_data = calculator_dir / "public" / "data" / "space-age-2.0.55.json"
    images_dir = calculator_dir / "public" / "images"

    required = [
        dump_dir / "data-raw-dump.json",
        dump_dir / "factorio-version.txt",
        dump_dir / "mod-list.json",
        dump_dir / "recipe-locale.json",
        dump_dir / "item-locale.json",
        dump_dir / "recipe",
        dump_dir / "item",
        dump_dir / "entity",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise ExportError("Missing Factorio export files:\n- " + "\n- ".join(missing))

    version, build_number = extract_version(dump_dir / "factorio-version.txt")
    if version != TARGET_VERSION:
        raise ExportError(f"Expected Factorio {TARGET_VERSION}, got {version}")

    mod_list = load_json(dump_dir / "mod-list.json")
    enabled_mods = sorted(
        mod["name"]
        for mod in mod_list.get("mods", [])
        if mod.get("enabled")
    )
    if enabled_mods != sorted(EXPECTED_MODS):
        raise ExportError(
            "Expected only the official Space Age mods to be enabled; got: "
            + ", ".join(enabled_mods)
        )

    builder = DatasetBuilder(dump_dir, old_data, images_dir)
    dataset = builder.build(version, build_number, images_dir)
    dataset["mods"] = EXPECTED_MODS
    validation = validate_dataset(dataset, builder.raw)
    output.parent.mkdir(parents=True, exist_ok=True)
    write_json(output, dataset)
    write_json(report, {
        "version": version,
        "build": build_number,
        "source": "Factorio built-in exports",
        "mods": EXPECTED_MODS,
        **validation,
    })

    print(f"Created {output}")
    print(f"Created {images_dir / ('sprite-sheet-' + dataset['sprites']['hash'] + '.png')}")
    print(f"Created {report}")
    print(json.dumps(validation, indent=2))


if __name__ == "__main__":
    main()
