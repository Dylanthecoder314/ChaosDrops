import { world, system } from "@minecraft/server";
import { openMenu } from "./menu.js";
import * as U from "./util.js";

let randomItemId = () => "minecraft:diamond";
export function wireItems(deps) {
  randomItemId = deps.randomItemId;
}

const GOOD = [["speed", 1, "Speed"], ["haste", 1, "Haste"], ["strength", 1, "Strength"], ["regeneration", 1, "Regeneration"],
  ["resistance", 1, "Resistance"], ["jump_boost", 1, "Jump Boost"], ["night_vision", 0, "Night Vision"],
  ["fire_resistance", 0, "Fire Resistance"], ["absorption", 2, "Absorption"], ["water_breathing", 0, "Water Breathing"],
  ["invisibility", 0, "Invisibility"], ["health_boost", 1, "Health Boost"]];
const BAD = [["slowness", 0, "Slowness"], ["nausea", 0, "Nausea"], ["levitation", 0, "Levitation"],
  ["hunger", 1, "Hunger"], ["weakness", 0, "Weakness"]];
const BLADE_CURSES = [["poison", 1, 5], ["wither", 1, 4], ["slowness", 2, 4], ["weakness", 1, 5], ["levitation", 1, 2],
  ["blindness", 0, 3]];

const lastUse = new Map();
const diceReady = new Map();

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (!itemStack || source?.typeId !== "minecraft:player") return;
  const now = system.currentTick;
  if ((lastUse.get(source.id) ?? -99) > now - 10) return;
  lastUse.set(source.id, now);
  if (itemStack.typeId === "chaos:chaos_codex") openMenu(source);
  else if (itemStack.typeId === "chaos:dice_of_destiny") rollDestiny(source);
});

world.afterEvents.itemCompleteUse.subscribe(({ source, itemStack }) => {
  if (itemStack?.typeId !== "chaos:chaos_apple") return;
  const picks = [U.pick(GOOD), U.pick(GOOD), U.chance(0.3) ? U.pick(BAD) : U.pick(GOOD)];
  for (const [id, amp] of picks) U.effect(source, id, 30, amp);
  U.actionbar(source, `§d[Chaos Apple] §f${picks.map((p) => p[2]).join(", ")}`);
  U.burst(source.dimension, "minecraft:witchspell_emitter", source.location, 4, 0.5);
});

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  if (damagingEntity?.typeId !== "minecraft:player" || !hitEntity) return;
  let held;
  try {
    held = damagingEntity.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
  } catch {}
  if (held?.typeId !== "chaos:chaos_blade") return;
  const dim = hitEntity.dimension;
  if (U.chance(0.25)) {
    const [id, amp, seconds] = U.pick(BLADE_CURSES);
    U.effect(hitEntity, id, seconds, amp);
    U.burst(dim, "minecraft:witchspell_emitter", hitEntity.location, 3, 0.4);
  }
  if (U.chance(0.06)) U.spawnEntity(dim, "minecraft:lightning_bolt", hitEntity.location);
  if (U.chance(0.1)) {
    const hp = U.health(damagingEntity);
    if (hp) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 2));
    U.particle(dim, "minecraft:heart_particle", U.offset(damagingEntity.location, 0, 2, 0));
  }
});

const DICE = {
  1: ["§4Critical fail!", (p) => U.spawnEntity(p.dimension, "minecraft:lightning_bolt", U.offset(p.location, 1.5, 0, 1.5))],
  2: ["§cUnlucky...", (p) => { U.effect(p, "hunger", 15, 1); U.effect(p, "slowness", 10); }],
  3: ["§eA little something.", (p) => { for (let i = 0; i < 3; i++) U.giveItem(p, randomItemId()); }],
  4: ["§aFeeling good!", (p) => { U.effect(p, "regeneration", 15, 1); U.effect(p, "absorption", 60, 1); }],
  5: ["§bPOWER UP!", (p) => { U.effect(p, "strength", 30, 1); U.effect(p, "speed", 30, 1); U.effect(p, "resistance", 30, 0); }],
  6: ["§6§lJACKPOT!", (p) => { U.giveItem(p, "minecraft:diamond", 5); U.giveItem(p, "chaos:lucky_block", 2); U.giveItem(p, randomItemId()); }],
};

function rollDestiny(player) {
  const now = system.currentTick;
  const readyAt = diceReady.get(player.id) ?? 0;
  if (readyAt > now) {
    U.actionbar(player, `§7The dice need to rest... ${Math.ceil((readyAt - now) / 20)}s`);
    return;
  }
  diceReady.set(player.id, now + 600);
  const n = U.rint(1, 6);
  const [text, run] = DICE[n];
  U.title(player, `§6§l${n}`, text);
  U.playerSound(player, "random.orb", { pitch: 0.5 + n * 0.2 });
  try {
    run(player);
  } catch (e) {
    console.warn(`[Chaos Drops] dice ${n}: ${e}`);
  }
}

export function giveStarterCodex(player) {
  if (player.hasTag("chaos:got_codex")) return;
  player.addTag("chaos:got_codex");
  U.giveItem(player, "chaos:chaos_codex");
}
