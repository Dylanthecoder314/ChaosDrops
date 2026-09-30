import { world, ItemStack } from "@minecraft/server";

export const rand = (min, max) => min + Math.random() * (max - min);
export const rint = (min, max) => Math.floor(rand(min, max + 1));
export const chance = (p) => Math.random() < p;
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function weightedPick(entries) {
  const total = entries.reduce((sum, e) => sum + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.w;
    if (r < 0) return e;
  }
  return entries[entries.length - 1];
}

// Entity.isValid is a method in @minecraft/server 1.x and a property in 2.x.
export function isValid(entity) {
  try {
    if (!entity) return false;
    return typeof entity.isValid === "function" ? entity.isValid() : entity.isValid !== false;
  } catch {
    return false;
  }
}

// GameMode enum values changed case between API versions, so compare loosely.
export function isCreative(player) {
  try {
    const mode = String(player.getGameMode()).toLowerCase();
    return mode === "creative" || mode === "spectator";
  } catch {
    return false;
  }
}

export const blockCenter = (loc) => ({ x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
export const offset = (loc, dx, dy, dz) => ({ x: loc.x + dx, y: loc.y + dy, z: loc.z + dz });

const badItems = new Set();

export function makeStack(id, amount = 1) {
  if (badItems.has(id)) return undefined;
  try {
    const stack = new ItemStack(id, 1);
    stack.amount = Math.max(1, Math.min(amount, stack.maxAmount));
    return stack;
  } catch {
    badItems.add(id);
    return undefined;
  }
}

export const isBadItem = (id) => badItems.has(id);

export function spawnStack(dim, id, loc, amount = 1, pop = true) {
  const stack = makeStack(id, amount);
  if (!stack) return undefined;
  try {
    const entity = dim.spawnItem(stack, loc);
    if (pop) {
      try {
        entity.applyImpulse({ x: rand(-0.12, 0.12), y: rand(0.12, 0.28), z: rand(-0.12, 0.12) });
      } catch {}
    }
    return entity;
  } catch {
    return undefined;
  }
}

export function giveItem(player, id, amount = 1) {
  const stack = makeStack(id, amount);
  if (!stack) return;
  try {
    const leftover = player.getComponent("minecraft:inventory").container.addItem(stack);
    if (leftover) player.dimension.spawnItem(leftover, player.location);
  } catch {}
}

export function particle(dim, id, loc) {
  try {
    dim.spawnParticle(id, loc);
  } catch {}
}

export function burst(dim, id, loc, count, radius) {
  for (let i = 0; i < count; i++) {
    particle(dim, id, offset(loc, rand(-radius, radius), rand(0, radius * 1.5), rand(-radius, radius)));
  }
}

export function sound(dim, id, loc, options = {}) {
  try {
    dim.playSound(id, loc, options);
  } catch {}
}

export function playerSound(player, id, options = {}) {
  try {
    player.playSound(id, options);
  } catch {}
}

export function actionbar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {}
}

export function title(player, main, subtitle = "") {
  try {
    player.onScreenDisplay.setTitle(main, { subtitle, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
  } catch {}
}

export function tell(player, message) {
  try {
    player.sendMessage(message);
  } catch {}
}

export function broadcast(message) {
  try {
    world.sendMessage(message);
  } catch {}
}

export function effect(entity, id, seconds, amplifier = 0, showParticles = true) {
  try {
    entity.addEffect(id, Math.round(seconds * 20), { amplifier, showParticles });
  } catch {}
}

export function damage(entity, amount, source) {
  try {
    entity.applyDamage(amount, source ? { cause: "entityAttack", damagingEntity: source } : undefined);
  } catch {
    try {
      entity.applyDamage(amount);
    } catch {}
  }
}

// applyKnockback takes (VectorXZ, vertical) in 2.x and (dirX, dirZ, h, v) in 1.x.
export function knockback(entity, dx, dz, horizontal, vertical) {
  const len = Math.hypot(dx, dz) || 1;
  try {
    entity.applyKnockback({ x: (dx / len) * horizontal, z: (dz / len) * horizontal }, vertical);
  } catch {
    try {
      entity.applyKnockback(dx / len, dz / len, horizontal, vertical);
    } catch {}
  }
}

export function spawnEntity(dim, id, loc) {
  try {
    return dim.spawnEntity(id, loc);
  } catch {
    return undefined;
  }
}

export function health(entity) {
  try {
    return entity.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
}

export function playersNear(dim, loc, radius) {
  try {
    return dim.getPlayers({ location: loc, maxDistance: radius }).filter((p) => !isCreative(p));
  } catch {
    return [];
  }
}

export function allPlayersNear(dim, loc, radius) {
  try {
    return dim.getPlayers({ location: loc, maxDistance: radius });
  } catch {
    return [];
  }
}

export function countNear(dim, loc, types, radius) {
  let n = 0;
  for (const type of types) {
    try {
      n += dim.getEntities({ type, location: loc, maxDistance: radius }).length;
    } catch {}
  }
  return n;
}

const PASSABLE = new Set([
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:snow_layer",
  "minecraft:short_dry_grass", "minecraft:tall_dry_grass", "minecraft:bush", "minecraft:leaf_litter",
  "minecraft:dandelion", "minecraft:poppy", "minecraft:deadbush", "minecraft:wildflowers", "minecraft:pink_petals",
  "minecraft:vine", "minecraft:glow_lichen", "minecraft:seagrass",
]);

function isOpen(dim, x, y, z) {
  try {
    const block = dim.getBlock({ x, y, z });
    return !!block && (block.isAir || PASSABLE.has(block.typeId));
  } catch {
    return false;
  }
}

export function isAirAt(dim, loc) {
  try {
    return !!dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) })?.isAir;
  } catch {
    return false;
  }
}

// A 2-high open space with something solid underneath, searched up/down from y.
export function safeSpot(dim, x, y, z, range = 6) {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const by = Math.floor(y);
  for (let dy = 0; dy <= range; dy++) {
    for (const yy of dy === 0 ? [by] : [by + dy, by - dy]) {
      if (!isOpen(dim, bx, yy, bz) || !isOpen(dim, bx, yy + 1, bz)) continue;
      try {
        const below = dim.getBlock({ x: bx, y: yy - 1, z: bz });
        if (below && !below.isAir && !below.isLiquid) return { x: bx + 0.5, y: yy, z: bz + 0.5 };
      } catch {}
    }
  }
  return undefined;
}

export function spotAround(dim, loc, minR, maxR, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(minR, maxR);
    const spot = safeSpot(dim, loc.x + Math.cos(a) * r, loc.y, loc.z + Math.sin(a) * r);
    if (spot) return spot;
  }
  return undefined;
}

const DIMENSION_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

export function dimensions() {
  const out = [];
  for (const id of DIMENSION_IDS) {
    try {
      out.push(world.getDimension(id));
    } catch {}
  }
  return out;
}

export function prettyName(id) {
  return id
    .replace(/^[a-z_]+:/, "")
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
