// Lucky Block: 24 outcomes, roughly 60% good, 25% bad, 15% weird.
import { system } from "@minecraft/server";
import { settings } from "./settings.js";
import * as U from "./util.js";

// Imported lazily to avoid a circular import with drops.js/bosses.js at load time.
let randomItemId = () => "minecraft:diamond";
let spawnBossNear = () => {};
export function wireLucky(deps) {
  randomItemId = deps.randomItemId;
  spawnBossNear = deps.spawnBossNear;
}

const FRIENDS = ["minecraft:wolf", "minecraft:cat", "minecraft:parrot", "minecraft:fox", "minecraft:axolotl",
  "minecraft:allay", "minecraft:horse", "minecraft:panda"];
const AMBUSH = ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider", "minecraft:husk"];
const GOOD_EFFECTS = [["speed", 1], ["haste", 1], ["strength", 1], ["regeneration", 1], ["resistance", 0],
  ["jump_boost", 1], ["night_vision", 0], ["fire_resistance", 0], ["absorption", 1], ["health_boost", 1]];
const BAD_EFFECTS = [["slowness", 1], ["mining_fatigue", 1], ["weakness", 0], ["poison", 0], ["hunger", 1],
  ["nausea", 0], ["blindness", 0], ["levitation", 0]];

function scatter(ctx, id, count, amount = 1) {
  for (let i = 0; i < count; i++) {
    system.runTimeout(() => U.spawnStack(ctx.dim, id, U.offset(ctx.loc, 0, 0.3, 0), amount), i * 2);
  }
}

const OUTCOMES = [
  // ---- good
  { w: 14, text: "§aTreasure pile!", run(ctx) {
    for (let i = 0; i < U.rint(4, 7); i++) scatter(ctx, randomItemId(), 1);
  } },
  { w: 6, text: "§bDiamond shower!", run(ctx) {
    scatter(ctx, "minecraft:diamond", U.rint(5, 12));
    U.burst(ctx.dim, "minecraft:villager_happy", ctx.loc, 12, 1.5);
  } },
  { w: 5, text: "§fKnight kit!", run(ctx) {
    for (const id of ["minecraft:iron_helmet", "minecraft:iron_chestplate", "minecraft:iron_leggings",
      "minecraft:iron_boots", "minecraft:iron_sword", "minecraft:shield"]) scatter(ctx, id, 1);
  } },
  { w: 5, text: "§6Golden feast!", run(ctx) {
    scatter(ctx, "minecraft:golden_apple", 3);
    scatter(ctx, "minecraft:golden_carrot", 1, 8);
    if (U.chance(0.2)) scatter(ctx, "minecraft:enchanted_golden_apple", 1);
  } },
  { w: 5, text: "§aXP fountain!", run(ctx) {
    for (let i = 0; i < 15; i++) {
      system.runTimeout(() => U.spawnEntity(ctx.dim, "minecraft:xp_orb", U.offset(ctx.loc, U.rand(-1, 1), 0.5, U.rand(-1, 1))), i * 3);
    }
  } },
  { w: 5, text: "§dA new best friend!", run(ctx) {
    const pet = U.spawnEntity(ctx.dim, U.pick(FRIENDS), ctx.loc);
    try {
      pet?.getComponent("minecraft:tameable")?.tame(ctx.player);
    } catch {}
    U.burst(ctx.dim, "minecraft:heart_particle", ctx.loc, 8, 1);
  } },
  { w: 6, text: "§dChaos shards!", run(ctx) {
    scatter(ctx, "chaos:chaos_shard", 1, U.rint(2, 4));
  } },
  { w: 4, text: "§eLucky chain! More Lucky Blocks!", run(ctx) {
    let placed = 0;
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]]) {
      if (placed >= 3) break;
      const spot = U.safeSpot(ctx.dim, ctx.loc.x + dx, ctx.loc.y - 0.5, ctx.loc.z + dz, 3);
      if (!spot) continue;
      try {
        ctx.dim.getBlock({ x: Math.floor(spot.x), y: spot.y, z: Math.floor(spot.z) }).setType("chaos:lucky_block");
        placed++;
      } catch {}
    }
    if (!placed) scatter(ctx, "chaos:lucky_block", 1, 3);
  } },
  { w: 2, text: "§6§lJACKPOT!!!", run(ctx) {
    scatter(ctx, "minecraft:netherite_ingot", 1);
    scatter(ctx, "minecraft:diamond_block", 1, 2);
    scatter(ctx, "minecraft:totem_of_undying", 1);
    scatter(ctx, "minecraft:emerald", 1, 16);
    U.burst(ctx.dim, "minecraft:totem_particle", ctx.loc, 20, 1.5);
    U.sound(ctx.dim, "random.totem", ctx.loc);
  } },
  { w: 4, text: "§dChaos apples!", run(ctx) {
    scatter(ctx, "chaos:chaos_apple", 1, 3);
  } },
  { w: 3, text: "§bPotion of greatness!", run(ctx) {
    for (let i = 0; i < 3; i++) {
      const [id, amp] = U.pick(GOOD_EFFECTS);
      U.effect(ctx.player, id, 60, amp);
    }
  } },
  // ---- bad
  { w: 5, text: "§cZap!", run(ctx) {
    for (let i = 0; i < 3; i++) {
      system.runTimeout(() => U.spawnEntity(ctx.dim, "minecraft:lightning_bolt",
        U.offset(ctx.player.location, U.rand(-3, 3), 0, U.rand(-3, 3))), i * 10);
    }
  } },
  { w: 5, text: "§cAmbush!", run(ctx) {
    for (let i = 0; i < 3; i++) {
      const spot = U.spotAround(ctx.dim, ctx.loc, 2, 5);
      if (spot) U.spawnEntity(ctx.dim, U.pick(AMBUSH), spot);
    }
  } },
  { w: 4, text: "§cIt's ticking...", run(ctx) {
    U.sound(ctx.dim, "random.fuse", ctx.loc);
    for (let i = 0; i < 4; i++) system.runTimeout(() => U.particle(ctx.dim, "minecraft:lava_particle", ctx.loc), i * 10);
    system.runTimeout(() => {
      try {
        ctx.dim.createExplosion(ctx.loc, 3, { breaksBlocks: false, causesFire: false });
      } catch {}
    }, 45);
  } },
  { w: 4, text: "§cTo the moon!", run(ctx) {
    U.knockback(ctx.player, U.rand(-1, 1), U.rand(-1, 1), 0.3, 2.2);
    system.runTimeout(() => U.effect(ctx.player, "slow_falling", 12), 25);
  } },
  { w: 3, text: "§cSticky situation!", run(ctx) {
    const p = ctx.player.location;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
      for (const dy of [0, 1]) {
        const at = { x: Math.floor(p.x) + dx, y: Math.floor(p.y) + dy, z: Math.floor(p.z) + dz };
        if (dx === 0 && dz === 0 && dy === 0) continue;
        try {
          const block = ctx.dim.getBlock(at);
          if (block?.isAir) block.setType("minecraft:web");
        } catch {}
      }
    }
  } },
  { w: 3, text: "§cAnvil rain! Look up!", run(ctx) {
    for (let i = 0; i < 3; i++) {
      const p = ctx.player.location;
      const at = { x: Math.floor(p.x + U.rand(-2, 2)), y: Math.floor(p.y) + 9, z: Math.floor(p.z + U.rand(-2, 2)) };
      try {
        const block = ctx.dim.getBlock(at);
        if (block?.isAir) block.setType("minecraft:anvil");
      } catch {}
    }
  } },
  { w: 3, text: "§cSilverfish swarm!", run(ctx) {
    for (let i = 0; i < 5; i++) U.spawnEntity(ctx.dim, "minecraft:silverfish", ctx.loc);
  } },
  { w: 3, text: "§cBad luck curse!", run(ctx) {
    for (let i = 0; i < 2; i++) {
      const [id, amp] = U.pick(BAD_EFFECTS);
      U.effect(ctx.player, id, 10, amp);
    }
  } },
  // ---- weird
  { w: 3, text: "§aA Loot Goblin burst out!", run(ctx) {
    U.spawnEntity(ctx.dim, "chaos:loot_goblin", ctx.loc);
  } },
  { w: 3, text: "§5Teleport roulette!", run(ctx) {
    const spot = U.spotAround(ctx.dim, ctx.player.location, 12, 28, 20);
    if (!spot) return U.actionbar(ctx.player, "§7...the teleport fizzled.");
    U.burst(ctx.dim, "minecraft:mob_portal", ctx.player.location, 10, 1);
    try {
      ctx.player.teleport(spot);
    } catch {}
    U.sound(ctx.dim, "mob.endermen.portal", spot);
  } },
  { w: 3, text: "§dPig party!", run(ctx) {
    for (let i = 0; i < 6; i++) U.spawnEntity(ctx.dim, "minecraft:pig", ctx.loc);
    for (let i = 0; i < 6; i++) system.runTimeout(() => U.sound(ctx.dim, "note.pling", ctx.loc, { pitch: 0.6 + i * 0.2 }), i * 4);
  } },
  { w: 2, text: "§eRandom mob egg!", run(ctx) {
    scatter(ctx, U.pick(["minecraft:cow_spawn_egg", "minecraft:sheep_spawn_egg", "minecraft:horse_spawn_egg",
      "minecraft:wolf_spawn_egg", "minecraft:cat_spawn_egg", "minecraft:allay_spawn_egg"]), 1);
  } },
  { w: 1, text: "§4§lBOSS SURPRISE!", run(ctx) {
    if (!settings().surpriseBosses) return OUTCOMES[0].run(ctx);
    U.title(ctx.player, "§4§lUH OH", "§cSomething is coming...");
    system.runTimeout(() => spawnBossNear(ctx.player, U.pick(["chaos_titan", "void_wraith"])), 60);
  } },
];

export function openLuckyBlock(player, dim, loc) {
  const outcome = U.weightedPick(OUTCOMES);
  const ctx = { player, dim, loc };
  U.burst(dim, "minecraft:villager_happy", loc, 6, 0.6);
  U.sound(dim, "random.levelup", loc, { pitch: 1.4, volume: 0.6 });
  U.actionbar(player, `§e[Lucky Block] ${outcome.text}`);
  try {
    outcome.run(ctx);
  } catch (e) {
    console.warn(`[Chaos Drops] lucky block "${outcome.text}": ${e}`);
  }
}
