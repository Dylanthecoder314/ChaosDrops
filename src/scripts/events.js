// World-wide chaos events on a timer (configurable in the Chaos Codex).
import { world, system } from "@minecraft/server";
import { settings, temp } from "./settings.js";
import * as U from "./util.js";

let randomItemId = () => "minecraft:diamond";
let spawnBossNear = () => {};
export function wireEvents(deps) {
  randomItemId = deps.randomItemId;
  spawnBossNear = deps.spawnBossNear;
}

const PARTY_MOBS = ["minecraft:pig", "minecraft:sheep", "minecraft:chicken", "minecraft:rabbit", "minecraft:zombie",
  "minecraft:skeleton", "minecraft:slime", "minecraft:cow", "minecraft:spider", "minecraft:fox"];
const FOOD = ["minecraft:cooked_beef", "minecraft:bread", "minecraft:baked_potato", "minecraft:cookie",
  "minecraft:pumpkin_pie", "minecraft:golden_carrot", "minecraft:cooked_porkchop"];

const EVENTS = [
  { w: 5, name: "Item Rain", desc: "Random items are falling from the sky!", run(p) {
    for (let i = 0; i < 10; i++) {
      system.runTimeout(() => {
        if (U.isValid(p)) U.spawnStack(p.dimension, randomItemId(), U.offset(p.location, U.rand(-4, 4), 8, U.rand(-4, 4)), 1, false);
      }, i * 6);
    }
  } },
  { w: 4, name: "Lucky Delivery", desc: "A Lucky Block appeared next to you!", run(p) {
    const spot = U.spotAround(p.dimension, p.location, 1.5, 3);
    try {
      if (spot) p.dimension.getBlock({ x: Math.floor(spot.x), y: spot.y, z: Math.floor(spot.z) }).setType("chaos:lucky_block");
      else U.giveItem(p, "chaos:lucky_block");
    } catch {
      U.giveItem(p, "chaos:lucky_block");
    }
  } },
  { w: 3, name: "Goblin Raid", desc: "A Loot Goblin is nearby. Catch it!", run(p) {
    const spot = U.spotAround(p.dimension, p.location, 6, 10);
    if (spot) U.spawnEntity(p.dimension, "chaos:loot_goblin", spot);
  } },
  { w: 3, name: "Low Gravity", desc: "Jump higher, fall slower (45s).", run(p) {
    U.effect(p, "jump_boost", 45, 3);
    U.effect(p, "slow_falling", 45);
  } },
  { w: 3, name: "Speed Frenzy", desc: "Everyone gets Speed and Haste (45s).", run(p) {
    U.effect(p, "speed", 45, 2);
    U.effect(p, "haste", 45, 2);
  } },
  { w: 3, name: "Midas Touch", desc: "For 60s every block drops treasure!", global() {
    temp.midasUntil = system.currentTick + 1200;
  }, needsDrops: true },
  { w: 3, name: "Double Drops", desc: "For 90s every block drops twice as much!", global() {
    temp.doubleUntil = system.currentTick + 1800;
  }, needsDrops: true },
  { w: 2, name: "Mob Party", desc: "Uninvited guests have arrived!", run(p) {
    for (let i = 0; i < 4; i++) {
      const spot = U.spotAround(p.dimension, p.location, 4, 8);
      if (spot) U.spawnEntity(p.dimension, U.pick(PARTY_MOBS), spot);
    }
  } },
  { w: 2, name: "Thunderstorm", desc: "The sky is angry!", global() {
    try {
      world.getDimension("minecraft:overworld").setWeather("Thunder", 2400);
    } catch {}
  }, run(p) {
    for (let i = 0; i < 3; i++) {
      system.runTimeout(() => {
        if (!U.isValid(p)) return;
        const a = Math.random() * Math.PI * 2;
        U.spawnEntity(p.dimension, "minecraft:lightning_bolt", U.offset(p.location, Math.cos(a) * 10, 0, Math.sin(a) * 10));
      }, 20 + i * 30);
    }
  } },
  { w: 2, name: "Feast", desc: "Free food and healing for everyone!", run(p) {
    U.effect(p, "regeneration", 10, 1);
    U.effect(p, "saturation", 2, 4);
    U.giveItem(p, U.pick(FOOD), 6);
  } },
  { w: 1, name: "Blindfold", desc: "Lights out... but there's a gift.", run(p) {
    U.effect(p, "blindness", 6);
    system.runTimeout(() => {
      if (U.isValid(p)) U.giveItem(p, randomItemId());
    }, 120);
  } },
  { w: 1, name: "Boss Omen", desc: "A boss is coming for someone...", needsBosses: true, global() {
    const players = world.getAllPlayers().filter((p) => !U.isCreative(p));
    if (!players.length) return;
    const victim = U.pick(players);
    U.title(victim, "§4§lBOSS OMEN", "§cIt's coming for YOU in 10 seconds!");
    system.runTimeout(() => {
      if (U.isValid(victim)) spawnBossNear(victim, U.pick(["chaos_titan", "void_wraith"]));
    }, 200);
  } },
];

export function triggerChaosEvent() {
  const s = settings();
  const options = EVENTS.filter((e) => (!e.needsDrops || s.dropMode !== "vanilla") && (!e.needsBosses || s.surpriseBosses));
  const event = U.weightedPick(options);
  const players = world.getAllPlayers();
  for (const p of players) {
    U.title(p, "§d§lCHAOS EVENT!", `§e${event.name}`);
    U.tell(p, `§d[Chaos Event] §e${event.name}§7 - ${event.desc}`);
    U.playerSound(p, "random.levelup", { pitch: 0.8 });
  }
  try {
    event.global?.();
  } catch (e) {
    console.warn(`[Chaos Drops] event ${event.name}: ${e}`);
  }
  if (event.run) {
    for (const p of players) {
      try {
        event.run(p);
      } catch (e) {
        console.warn(`[Chaos Drops] event ${event.name}: ${e}`);
      }
    }
  }
  return event.name;
}

let elapsed = 0;
let warned = false;

system.runInterval(() => {
  const minutes = settings().eventMinutes;
  if (!minutes || world.getAllPlayers().length === 0) {
    elapsed = 0;
    warned = false;
    return;
  }
  elapsed += 20;
  const period = minutes * 1200;
  if (!warned && elapsed >= period - 200) {
    warned = true;
    for (const p of world.getAllPlayers()) U.actionbar(p, "§dA chaos event begins in 10 seconds...");
  }
  if (elapsed >= period) {
    elapsed = 0;
    warned = false;
    triggerChaosEvent();
  }
}, 20);

export function resetEventTimer() {
  elapsed = 0;
  warned = false;
}
