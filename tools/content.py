"""All behavior-pack and resource-pack JSON for Chaos Drops."""
import json
import os
import uuid

NS = "chaos"
VERSION = [1, 0, 0]
MIN_ENGINE = [1, 21, 90]  # @minecraft/server 2.0.0 needs 1.21.90+
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def stable_uuid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"chaosdrops/{name}"))


BP_UUID = stable_uuid("bp")
RP_UUID = stable_uuid("rp")

# --------------------------------------------------------------------------- item pool

# Unobtainable or world-breaking blocks never enter the random pool.
BLOCKED = {
    "minecraft:crafting_items_catalog", "minecraft:bedrock", "minecraft:mob_spawner", "minecraft:trial_spawner",
    "minecraft:vault", "minecraft:end_portal_frame", "minecraft:reinforced_deepslate", "minecraft:budding_amethyst",
    "minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:potion", "minecraft:farmland",
    "minecraft:frog_spawn", "minecraft:infested_deepslate",
}
FRIENDLY_EGGS = {
    "chicken", "cow", "pig", "sheep", "camel", "donkey", "horse", "mule", "cat", "parrot", "wolf", "armadillo", "bee",
    "fox", "goat", "llama", "panda", "rabbit", "axolotl", "frog", "allay", "mooshroom", "sniffer", "copper_golem",
    "snow_golem", "turtle", "happy_ghast", "ocelot", "polar_bear",
}
CATEGORY_WEIGHT = {"construction": 1, "nature": 2, "items": 3, "equipment": 4}
BOOSTED = {  # a little extra excitement
    "minecraft:diamond": 8, "minecraft:emerald": 6, "minecraft:gold_ingot": 6, "minecraft:iron_ingot": 6,
    "minecraft:golden_apple": 5, "minecraft:ender_pearl": 5, "minecraft:experience_bottle": 5, "minecraft:tnt": 4,
    "minecraft:enchanted_golden_apple": 1, "minecraft:totem_of_undying": 2, "minecraft:elytra": 1,
    "minecraft:netherite_ingot": 2, "minecraft:nether_star": 1, "minecraft:dragon_egg": 1, "minecraft:mace": 1,
    "minecraft:heavy_core": 1, "minecraft:beacon": 1,
}
CUSTOM_POOL = {f"{NS}:chaos_shard": 40, f"{NS}:lucky_block": 30, f"{NS}:chaos_apple": 10, f"{NS}:goblin_bait": 3}


def vanilla_items():
    with open(os.path.join(DATA_DIR, "vanilla_items.json")) as f:
        return json.load(f)["items"]


def item_pool():
    pool = []
    for item, cat in vanilla_items():
        if item in BLOCKED:
            continue
        if item.endswith("_spawn_egg"):
            if item[len("minecraft:"):-len("_spawn_egg")] in FRIENDLY_EGGS:
                pool.append((item, 2))
            continue
        pool.append((item, BOOSTED.get(item, CATEGORY_WEIGHT.get(cat, 2))))
    pool.extend(CUSTOM_POOL.items())
    return pool


VALUABLES = [
    "minecraft:diamond", "minecraft:emerald", "minecraft:gold_ingot", "minecraft:iron_ingot", "minecraft:netherite_scrap",
    "minecraft:lapis_lazuli", "minecraft:amethyst_shard", "minecraft:golden_apple", "minecraft:gold_block",
    "minecraft:diamond_block", "minecraft:emerald_block", "minecraft:experience_bottle", f"{NS}:chaos_shard",
    f"{NS}:lucky_block",
]

# --------------------------------------------------------------------------- loot tables

RANDOM_ITEM = "loot_tables/chaos/random_item.json"


def random_item_table():
    entries = [{"type": "item", "name": item, "weight": w} for item, w in item_pool()]
    entries.append({"type": "item", "name": "minecraft:book", "weight": 10, "functions": [{"function": "enchant_randomly", "treasure": True}]})
    for gear in ("minecraft:diamond_sword", "minecraft:diamond_pickaxe", "minecraft:iron_chestplate", "minecraft:bow"):
        entries.append({"type": "item", "name": gear, "weight": 2, "functions": [{"function": "enchant_randomly"}]})
    return {"pools": [{"rolls": 1, "entries": entries}]}


def rolls_table(lo, hi, extra_pools=()):
    rolls = lo if lo == hi else {"min": lo, "max": hi}
    return {"pools": [{"rolls": rolls, "entries": [{"type": "loot_table", "name": RANDOM_ITEM, "weight": 1}]}, *extra_pools]}


def fixed(item, lo=1, hi=1, chance=None):
    entry = {"type": "item", "name": item, "weight": 1}
    if hi > 1:
        entry["functions"] = [{"function": "set_count", "count": {"min": lo, "max": hi}}]
    pool = {"rolls": 1, "entries": [entry]}
    if chance is not None:
        pool["conditions"] = [{"condition": "random_chance", "chance": chance}]
    return pool


SKIP_ENTITY_TABLE = ("gear", "equipment", "armor_set_", "_rider", "saddle.json", "boat.json", "armor_stand.json")
BIG_MOBS = {"wither_boss": (8, 12), "elder_guardian": (3, 5), "warden": (4, 6), "ravager": (2, 4),
            "evocation_illager": (2, 4), "giant": (3, 5)}
SINGLE_ROLL = ("_shear", "cat_gift", "panda_sneeze", "armadillo_brush", "brushable_block", "piglin_barter")


def vanilla_overrides():
    """Replace vanilla mob, chest, fishing, barter and gift loot with random items."""
    with open(os.path.join(DATA_DIR, "vanilla_loot_tables.json")) as f:
        paths = json.load(f)
    out = {}
    for path in paths:
        name = os.path.basename(path)[:-5]
        if path.startswith("loot_tables/chests/"):
            out[path] = rolls_table(1, 3) if "/trial_chambers/reward" in path else rolls_table(4, 8)
        elif path.startswith("loot_tables/entities/"):
            if any(s in path for s in SKIP_ENTITY_TABLE):
                continue
            if name in BIG_MOBS:
                out[path] = rolls_table(*BIG_MOBS[name])
            elif any(s in name for s in SINGLE_ROLL):
                out[path] = rolls_table(1, 1)
            else:
                out[path] = rolls_table(1, 2)
        elif path in ("loot_tables/gameplay/fishing.json", "loot_tables/gameplay/jungle_fishing.json",
                      "loot_tables/gameplay/entities/sniffer_seeds.json"):
            out[path] = rolls_table(1, 1)
    return out


def boss_loot():
    return {
        "loot_tables/chaos/bosses/chaos_titan.json": rolls_table(10, 16, [
            fixed(f"{NS}:titan_heart"), fixed(f"{NS}:chaos_shard", 3, 6), fixed("minecraft:iron_block", 2, 5),
            fixed("minecraft:diamond", 2, 6), fixed(f"{NS}:lucky_block", 1, 3)]),
        "loot_tables/chaos/bosses/void_wraith.json": rolls_table(10, 16, [
            fixed(f"{NS}:void_essence"), fixed(f"{NS}:chaos_shard", 3, 6), fixed("minecraft:ender_pearl", 4, 8),
            fixed("minecraft:emerald", 3, 8), fixed(f"{NS}:lucky_block", 1, 3)]),
        "loot_tables/chaos/bosses/the_randomizer.json": rolls_table(20, 30, [
            fixed(f"{NS}:dice_of_destiny"), fixed(f"{NS}:chaos_shard", 8, 12), fixed("minecraft:nether_star"),
            fixed("minecraft:enchanted_golden_apple", 1, 2), fixed("minecraft:netherite_ingot", 1, 3),
            fixed(f"{NS}:lucky_block", 4, 6), fixed("minecraft:totem_of_undying")]),
        "loot_tables/chaos/bosses/loot_goblin.json": rolls_table(8, 14, [
            fixed(f"{NS}:chaos_shard", 2, 4), fixed("minecraft:gold_ingot", 3, 9), fixed(f"{NS}:lucky_block", 1, 2),
            fixed("minecraft:emerald", 1, 4, chance=0.5)]),
    }


# --------------------------------------------------------------------------- entities

def target_players(priority=2):
    return {"priority": priority, "must_see": False, "reselect_targets": True, "within_radius": 48,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 48}]}


def boss_common(name, health, family, collision, loot):
    return {
        "minecraft:type_family": {"family": ["chaos_boss", family, "monster", "mob"]},
        "minecraft:boss": {"hud_range": 55, "should_darken_sky": name != "loot_goblin"},
        "minecraft:health": {"value": health, "max": health},
        "minecraft:collision_box": collision,
        "minecraft:nameable": {},
        "minecraft:persistent": {},
        "minecraft:fire_immune": {},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"},
                                                 {"cause": "suffocation", "deals_damage": "no"}]},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_air": True, "breathes_water": True},
        "minecraft:follow_range": {"value": 48, "max": 48},
        "minecraft:loot": {"table": loot},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": target_players(),
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 16},
        "minecraft:behavior.random_look_around": {"priority": 9},
    }


def entity(identifier, components, groups=None, events=None):
    body = {
        "description": {"identifier": identifier, "is_spawnable": True, "is_summonable": True, "is_experimental": False},
        "components": components,
    }
    if groups:
        body["component_groups"] = groups
    if events:
        body["events"] = events
    return {"format_version": "1.21.0", "minecraft:entity": body}


def enrage_sensor(hp):
    return {"minecraft:environment_sensor": {"triggers": [
        {"filters": {"test": "actor_health", "subject": "self", "operator": "<=", "value": hp}, "event": "chaos:enrage"}]}}


PHASE_EVENTS = {
    "minecraft:entity_spawned": {"add": {"component_groups": ["chaos:phase_one"]}},
    "chaos:enrage": {"remove": {"component_groups": ["chaos:phase_one"]}, "add": {"component_groups": ["chaos:phase_two"]}},
}

FANGS = {"priority": 3, "summon_choices": [
    {"min_activation_range": 0, "max_activation_range": 5, "cooldown_time": 7, "weight": 3, "cast_duration": 1.2,
     "particle_color": "#FFE040FF", "start_sound_event": "cast.spell",
     "sequence": [
         {"shape": "circle", "target": "self", "base_delay": 0.8, "delay_per_summon": 0, "num_entities_spawned": 8,
          "entity_type": "minecraft:evocation_fang", "size": 2.2, "entity_lifespan": 1.1, "sound_event": "prepare.attack"},
         {"shape": "circle", "target": "self", "base_delay": 0.3, "delay_per_summon": 0, "num_entities_spawned": 14,
          "entity_type": "minecraft:evocation_fang", "size": 3.6, "entity_lifespan": 1.1}]},
    {"min_activation_range": 5, "max_activation_range": 22, "cooldown_time": 9, "weight": 2, "cast_duration": 1.2,
     "particle_color": "#FFE040FF", "start_sound_event": "cast.spell",
     "sequence": [
         {"shape": "line", "target": "self", "base_delay": 0.8, "delay_per_summon": 0.05, "num_entities_spawned": 18,
          "entity_type": "minecraft:evocation_fang", "size": 22, "entity_lifespan": 1.1}]},
]}


def chaos_titan():
    c = boss_common("chaos_titan", 400, "chaos_titan", {"width": 2.0, "height": 3.8},
                    "loot_tables/chaos/bosses/chaos_titan.json")
    c.update({
        "minecraft:scale": {"value": 1.3},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:physics": {},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 250 : 40"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.summon_entity": FANGS,
        "minecraft:behavior.melee_box_attack": {"priority": 4, "speed_multiplier": 1.15, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.7},
    })
    groups = {
        "chaos:phase_one": {**enrage_sensor(200), "minecraft:movement": {"value": 0.24},
                            "minecraft:attack": {"damage": 11}},
        "chaos:phase_two": {"minecraft:mark_variant": {"value": 1}, "minecraft:movement": {"value": 0.31},
                            "minecraft:attack": {"damage": 16, "effect_name": "slowness", "effect_duration": 3}},
    }
    return entity(f"{NS}:chaos_titan", c, groups, PHASE_EVENTS)


def hover_movement(speed, fly):
    return {
        "minecraft:physics": {"has_gravity": False},
        "minecraft:can_fly": {},
        "minecraft:flying_speed": {"value": fly},
        "minecraft:movement": {"value": speed},
        "minecraft:movement.hover": {},
        "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_pass_doors": True,
                                       "can_path_from_air": True, "avoid_water": True, "avoid_damage_blocks": True,
                                       "avoid_sun": False},
        "minecraft:behavior.random_hover": {"priority": 7, "xz_dist": 10, "y_dist": 5, "y_offset": -1, "interval": 1,
                                            "hover_height": [2, 6]},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
    }


def ranged(def_id, lo, hi, radius, burst=1, interval=0.3):
    return {
        "minecraft:shooter": {"def": def_id},
        "minecraft:behavior.ranged_attack": {"priority": 3, "attack_interval_min": lo, "attack_interval_max": hi,
                                             "attack_radius": radius, "burst_shots": burst, "burst_interval": interval,
                                             "charge_charged_trigger": 0.0, "charge_shoot_trigger": 1.0},
    }


def void_wraith():
    c = boss_common("void_wraith", 300, "chaos_wraith", {"width": 1.0, "height": 2.6},
                    "loot_tables/chaos/bosses/void_wraith.json")
    c["minecraft:type_family"]["family"].append("undead")
    c.update(hover_movement(0.25, 0.2))
    c.update({"minecraft:knockback_resistance": {"value": 0.6},
              "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 250 : 40"}})
    groups = {
        "chaos:phase_one": {**enrage_sensor(150), **ranged("minecraft:shulker_bullet", 1.5, 3.0, 20)},
        "chaos:phase_two": {"minecraft:mark_variant": {"value": 1}, "minecraft:flying_speed": {"value": 0.28},
                            **ranged("minecraft:small_fireball", 1.2, 2.2, 24, burst=3)},
    }
    return entity(f"{NS}:void_wraith", c, groups, PHASE_EVENTS)


def the_randomizer():
    c = boss_common("the_randomizer", 600, "chaos_randomizer", {"width": 1.6, "height": 2.2},
                    "loot_tables/chaos/bosses/the_randomizer.json")
    c.update(hover_movement(0.22, 0.16))
    c.update({"minecraft:knockback_resistance": {"value": 1.0},
              "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 600 : 100"}})
    groups = {
        "chaos:phase_one": {**enrage_sensor(300), **ranged("minecraft:small_fireball", 3.0, 5.0, 24)},
        "chaos:phase_two": {"minecraft:mark_variant": {"value": 1},
                            **ranged("minecraft:small_fireball", 1.5, 3.0, 28, burst=3)},
    }
    return entity(f"{NS}:the_randomizer", c, groups, PHASE_EVENTS)


def loot_goblin():
    c = boss_common("loot_goblin", 40, "chaos_goblin", {"width": 0.6, "height": 1.3},
                    "loot_tables/chaos/bosses/loot_goblin.json")
    c["minecraft:type_family"] = {"family": ["chaos_goblin", "mob"]}
    c["minecraft:boss"] = {"hud_range": 24, "should_darken_sky": False}
    for k in ("minecraft:persistent", "minecraft:behavior.hurt_by_target", "minecraft:behavior.nearest_attackable_target",
              "minecraft:fire_immune"):
        c.pop(k)
    c.update({
        "minecraft:movement": {"value": 0.34},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True},
        "minecraft:despawn": {"despawn_from_distance": {"min_distance": 48, "max_distance": 96}},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 40 : 0"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 1.5},
        "minecraft:behavior.avoid_mob_type": {"priority": 2, "entity_types": [
            {"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 10,
             "walk_speed_multiplier": 1.3, "sprint_speed_multiplier": 1.6}]},
        "minecraft:behavior.random_stroll": {"priority": 5, "speed_multiplier": 1.0},
    })
    return entity(f"{NS}:loot_goblin", c)


ENTITIES = {"chaos_titan": chaos_titan, "void_wraith": void_wraith, "the_randomizer": the_randomizer,
            "loot_goblin": loot_goblin}

ENTITY_INFO = {
    "chaos_titan": {"name": "Chaos Titan", "egg": ("#2e1f45", "#e040ff"), "enraged": True},
    "void_wraith": {"name": "Void Wraith", "egg": ("#16122e", "#39f5ff"), "enraged": True},
    "the_randomizer": {"name": "The Randomizer", "egg": ("#efe9dc", "#b44cff"), "enraged": True},
    "loot_goblin": {"name": "Loot Goblin", "egg": ("#5fae3a", "#ffd23f"), "enraged": False},
}


def goblin_spawn_rules():
    return {"format_version": "1.8.0", "minecraft:spawn_rules": {
        "description": {"identifier": f"{NS}:loot_goblin", "population_control": "monster"},
        "conditions": [{
            "minecraft:spawns_on_surface": {},
            "minecraft:brightness_filter": {"min": 0, "max": 15, "adjust_for_weather": False},
            "minecraft:weight": {"default": 3},
            "minecraft:herd": {"min_size": 1, "max_size": 1},
            "minecraft:density_limit": {"surface": 1},
            "minecraft:biome_filter": {"test": "has_biome_tag", "value": "overworld"},
        }]}}


# --------------------------------------------------------------------------- items & block

def item(name, category, components, glint=False):
    comps = {
        "minecraft:icon": {"textures": {"default": name}},
        "minecraft:display_name": {"value": f"item.{NS}:{name}.name"},
    }
    if glint:
        comps["minecraft:glint"] = True
    comps.update(components)
    return {"format_version": "1.21.100", "minecraft:item": {
        "description": {"identifier": f"{NS}:{name}", "menu_category": {"category": category}},
        "components": comps}}


def summon_item(name, entity_name):
    return item(name, "items", {"minecraft:max_stack_size": 16,
                                "minecraft:entity_placer": {"entity": f"{NS}:{entity_name}"}}, glint=True)


ITEMS = {
    "chaos_shard": lambda: item("chaos_shard", "items", {"minecraft:max_stack_size": 64}),
    "chaos_codex": lambda: item("chaos_codex", "items", {"minecraft:max_stack_size": 1}, glint=True),
    "titan_core": lambda: summon_item("titan_core", "chaos_titan"),
    "void_eye": lambda: summon_item("void_eye", "void_wraith"),
    "loaded_die": lambda: summon_item("loaded_die", "the_randomizer"),
    "goblin_bait": lambda: summon_item("goblin_bait", "loot_goblin"),
    "titan_heart": lambda: item("titan_heart", "items", {"minecraft:max_stack_size": 16}, glint=True),
    "void_essence": lambda: item("void_essence", "items", {"minecraft:max_stack_size": 16}, glint=True),
    "dice_of_destiny": lambda: item("dice_of_destiny", "equipment", {"minecraft:max_stack_size": 1}, glint=True),
    "chaos_blade": lambda: item("chaos_blade", "equipment", {
        "minecraft:max_stack_size": 1,
        "minecraft:hand_equipped": {"value": True},
        "minecraft:damage": {"value": 10},
        "minecraft:durability": {"max_durability": 1800},
        "minecraft:enchantable": {"slot": "sword", "value": 15},
        "minecraft:repairable": {"repair_items": [{"items": [f"{NS}:chaos_shard"], "repair_amount": "query.max_durability * 0.25"}]},
        "minecraft:tags": {"tags": ["minecraft:is_sword"]},
    }),
    "chaos_apple": lambda: item("chaos_apple", "items", {
        "minecraft:max_stack_size": 64,
        "minecraft:food": {"nutrition": 6, "saturation_modifier": 0.8, "can_always_eat": True},
        "minecraft:use_animation": "eat",
        "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
    }, glint=True),
}

ITEM_NAMES = {
    "chaos_shard": "Chaos Shard", "chaos_codex": "Chaos Codex", "titan_core": "Titan Core",
    "void_eye": "Eye of the Void", "loaded_die": "Loaded Die", "goblin_bait": "Goblin Bait",
    "titan_heart": "Titan Heart", "void_essence": "Void Essence", "dice_of_destiny": "Dice of Destiny",
    "chaos_blade": "Chaos Blade", "chaos_apple": "Chaos Apple",
}


def lucky_block():
    return {"format_version": "1.21.60", "minecraft:block": {
        "description": {"identifier": f"{NS}:lucky_block", "menu_category": {"category": "construction"}},
        "components": {
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 0.4},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 3},
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {"*": {"texture": f"{NS}_lucky_block", "render_method": "opaque"}},
            "minecraft:loot": "loot_tables/empty.json",
            "minecraft:light_emission": 6,
            "minecraft:map_color": "#FFC933",
        }}}


# --------------------------------------------------------------------------- recipes

def shaped(name, pattern, key, result, count=1):
    return {"format_version": "1.21.0", "minecraft:recipe_shaped": {
        "description": {"identifier": f"{NS}:{name}"}, "tags": ["crafting_table"], "pattern": pattern,
        "key": {k: {"item": v} for k, v in key.items()}, "unlock": [{"item": f"{NS}:chaos_shard"}],
        "result": {"item": result, "count": count}}}


def shapeless(name, ingredients, result, count=1):
    return {"format_version": "1.21.0", "minecraft:recipe_shapeless": {
        "description": {"identifier": f"{NS}:{name}"}, "tags": ["crafting_table"],
        "ingredients": [{"item": i} for i in ingredients], "unlock": [{"item": f"{NS}:chaos_shard"}],
        "result": {"item": result, "count": count}}}


S = f"{NS}:chaos_shard"
RECIPES = {
    "chaos_codex": shapeless("chaos_codex", ["minecraft:book", S], f"{NS}:chaos_codex"),
    "titan_core": shaped("titan_core", ["SIS", "IBI", "SIS"], {"S": S, "I": "minecraft:iron_ingot", "B": "minecraft:iron_block"}, f"{NS}:titan_core"),
    "void_eye": shaped("void_eye", ["SPS", "POP", "SPS"], {"S": S, "P": "minecraft:ender_pearl", "O": "minecraft:obsidian"}, f"{NS}:void_eye"),
    "loaded_die": shaped("loaded_die", ["SSS", "TGV", "SSS"], {"S": S, "T": f"{NS}:titan_heart", "G": "minecraft:gold_block", "V": f"{NS}:void_essence"}, f"{NS}:loaded_die"),
    "goblin_bait": shapeless("goblin_bait", ["minecraft:gold_ingot", S, "minecraft:bread"], f"{NS}:goblin_bait"),
    "chaos_blade": shaped("chaos_blade", ["S", "D", "R"], {"S": S, "D": "minecraft:diamond", "R": "minecraft:stick"}, f"{NS}:chaos_blade"),
    "chaos_apple": shapeless("chaos_apple", ["minecraft:apple", S], f"{NS}:chaos_apple", 2),
    "lucky_block": shaped("lucky_block", ["NNN", "NSN", "NNN"], {"N": "minecraft:gold_nugget", "S": S}, f"{NS}:lucky_block"),
}

# --------------------------------------------------------------------------- manifests

DESCRIPTION = "Every drop is random! Custom bosses, Lucky Blocks, chaos events and more."


def bp_manifest():
    return {
        "format_version": 2,
        "header": {"name": "Chaos Drops (Behavior)", "description": DESCRIPTION, "uuid": BP_UUID,
                   "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": stable_uuid("bp-data"), "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": stable_uuid("bp-script"), "version": VERSION,
             "entry": "scripts/main.js"},
        ],
        "dependencies": [
            {"uuid": RP_UUID, "version": VERSION},
            {"module_name": "@minecraft/server", "version": "2.0.0"},
            {"module_name": "@minecraft/server-ui", "version": "2.0.0"},
        ],
    }


def rp_manifest():
    return {
        "format_version": 2,
        "header": {"name": "Chaos Drops (Resources)", "description": DESCRIPTION, "uuid": RP_UUID,
                   "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": stable_uuid("rp-resources"), "version": VERSION}],
        "dependencies": [{"uuid": BP_UUID, "version": VERSION}],
    }


# --------------------------------------------------------------------------- resource pack

def client_entity(name, spec):
    info = ENTITY_INFO[name]
    textures = {"default": f"textures/entity/chaos/{name}"}
    if info["enraged"]:
        textures["enraged"] = f"textures/entity/chaos/{name}_enraged"
    anims = {k: f"animation.chaos.{name}.{k}" for k in spec["anims"]}
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"{NS}:{name}",
        "materials": {"default": "entity_alphatest"},
        "textures": textures,
        "geometry": {"default": f"geometry.chaos.{name}"},
        "animations": anims,
        "scripts": {"animate": spec["animate"]},
        "render_controllers": ["controller.render.chaos.boss" if info["enraged"] else "controller.render.default"],
        "spawn_egg": {"base_color": info["egg"][0], "overlay_color": info["egg"][1]},
    }}}


RENDER_CONTROLLERS = {"format_version": "1.8.0", "render_controllers": {"controller.render.chaos.boss": {
    "arrays": {"textures": {"Array.skins": ["Texture.default", "Texture.enraged"]}},
    "geometry": "Geometry.default",
    "materials": [{"*": "Material.default"}],
    "textures": ["Array.skins[query.mark_variant]"],
}}}


def item_texture_json():
    return {"resource_pack_name": "chaos_drops", "texture_name": "atlas.items",
            "texture_data": {n: {"textures": f"textures/items/chaos/{n}"} for n in ITEMS}}


def terrain_texture_json():
    return {"resource_pack_name": "chaos_drops", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
            "texture_data": {f"{NS}_lucky_block": {"textures": "textures/blocks/chaos/lucky_block"}}}


BLOCKS_JSON = {"format_version": [1, 1, 0], f"{NS}:lucky_block": {"sound": "stone"}}


def lang_lines():
    lines = ["## Chaos Drops"]
    for n, label in ITEM_NAMES.items():
        lines.append(f"item.{NS}:{n}.name={label}")
    for n, info in ENTITY_INFO.items():
        lines.append(f"entity.{NS}:{n}.name={info['name']}")
        lines.append(f"item.spawn_egg.entity.{NS}:{n}.name=Spawn {info['name']}")
    lines.append(f"tile.{NS}:lucky_block.name=Lucky Block")
    lines.append("pack.name=Chaos Drops")
    lines.append(f"pack.description={DESCRIPTION}")
    return "\n".join(lines) + "\n"
