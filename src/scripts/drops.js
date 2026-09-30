// Random block drops.
//
// Vanilla still breaks the block (so tools lose durability, XP orbs drop, doors and beds
// break both halves). We snapshot nearby item entities before the break, delete whatever
// new items vanilla spawned, then spawn our random drop in their place.
import { world, system } from "@minecraft/server";
import { POOL, VALUABLES } from "./pool.js";
import { settings, temp } from "./settings.js";
import { blockCenter, isBadItem, isCreative, makeStack, particle, pick, spawnStack } from "./util.js";
import { openLuckyBlock } from "./lucky.js";

const LUCKY_BLOCK = "chaos:lucky_block";

const NEVER_RANDOM = new Set([
  "minecraft:fire", "minecraft:soul_fire", "minecraft:water", "minecraft:flowing_water", "minecraft:lava",
  "minecraft:flowing_lava", "minecraft:bubble_column", "minecraft:portal", "minecraft:end_portal",
  "minecraft:end_gateway", "minecraft:air", "minecraft:bedrock", "minecraft:barrier", "minecraft:structure_void",
  "minecraft:moving_block", "minecraft:piston_arm_collision", "minecraft:sticky_piston_arm_collision",
  "minecraft:frosted_ice",
]);

// These spill items they hold when broken. Only the block's own item is swapped out.
const HOLDS_ITEMS = new Set([
  "minecraft:jukebox", "minecraft:lectern", "minecraft:flower_pot", "minecraft:chiseled_bookshelf",
  "minecraft:decorated_pot", "minecraft:campfire", "minecraft:soul_campfire", "minecraft:crafter",
]);

const cumulative = [];
let totalWeight = 0;
for (const [, weight] of POOL) {
  totalWeight += weight;
  cumulative.push(totalWeight);
}

function itemAt(fraction) {
  const target = fraction * totalWeight;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] > target) hi = mid;
    else lo = mid + 1;
  }
  return POOL[lo][0];
}

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randomItemId() {
  for (let i = 0; i < 12; i++) {
    const id = itemAt(Math.random());
    if (!isBadItem(id) && makeStack(id)) return id;
  }
  return "minecraft:diamond";
}

// Shuffle mode: the same block always drops the same item until the seed changes.
export function shuffledItemFor(blockId) {
  const seed = settings().seed;
  for (let attempt = 0; attempt < 12; attempt++) {
    const id = itemAt(hash(`${seed}:${blockId}:${attempt}`) / 4294967296);
    if (!isBadItem(id) && makeStack(id)) return id;
  }
  return "minecraft:diamond";
}

const pending = new Map();
const placed = new Map();
const ours = new Set();
const keyOf = (dimId, loc) => `${dimId}|${loc.x}|${loc.y}|${loc.z}`;

function nearbyItemIds(dim, loc, radius) {
  try {
    return dim.getEntities({ type: "minecraft:item", location: loc, maxDistance: radius }).map((e) => e.id);
  } catch {
    return [];
  }
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => {
  if (!settings().placedDropSelf) return;
  const key = keyOf(dimension.id, block.location);
  placed.delete(key);
  placed.set(key, true);
  if (placed.size > 20000) placed.delete(placed.keys().next().value);
});

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const { block, player } = event;
  const dim = block.dimension;
  const typeId = block.typeId;
  const key = keyOf(dim.id, block.location);

  if (typeId === LUCKY_BLOCK) {
    pending.set(key, { lucky: true, tick: system.currentTick });
    return;
  }
  const s = settings();
  if (s.dropMode === "vanilla" || NEVER_RANDOM.has(typeId) || typeId.includes("shulker_box")) return;
  if (isCreative(player)) return;
  if (s.placedDropSelf && placed.has(key)) {
    placed.delete(key);
    return;
  }

  let holdsItems = HOLDS_ITEMS.has(typeId);
  if (!holdsItems) {
    try {
      holdsItems = !!block.getComponent("minecraft:inventory");
    } catch {}
  }
  pending.set(key, {
    typeId,
    holdsItems,
    before: new Set(nearbyItemIds(dim, blockCenter(block.location), 3)),
    tick: system.currentTick,
  });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const { block, player, dimension, brokenBlockPermutation } = event;
  const key = keyOf(dimension.id, block.location);
  const info = pending.get(key);
  if (!info) return;
  pending.delete(key);
  const center = blockCenter(block.location);

  if (info.lucky) {
    openLuckyBlock(player, dimension, center);
    return;
  }
  removeVanillaDrops(dimension, center, info);
  system.runTimeout(() => removeVanillaDrops(dimension, center, info), 1);
  dropRandom(dimension, center, brokenBlockPermutation?.type?.id ?? info.typeId);
});

function removeVanillaDrops(dim, center, info) {
  let items;
  try {
    items = dim.getEntities({ type: "minecraft:item", location: center, maxDistance: 2.5 });
  } catch {
    return;
  }
  for (const item of items) {
    if (info.before.has(item.id) || ours.has(item.id)) continue;
    if (info.holdsItems) {
      if (info.removedOwnItem) return;
      let stack;
      try {
        stack = item.getComponent("minecraft:item")?.itemStack;
      } catch {}
      if (stack?.typeId !== info.typeId) continue;
      info.removedOwnItem = true;
    }
    try {
      item.remove();
    } catch {}
  }
}

function spawnTracked(dim, id, center, amount) {
  const stack = makeStack(id, amount);
  if (!stack) return;
  // Non-stackable items (tools, armor) are spawned one entity per copy.
  const copies = stack.maxAmount === 1 ? amount : 1;
  for (let i = 0; i < copies; i++) {
    const entity = spawnStack(dim, id, center, stack.maxAmount === 1 ? 1 : amount);
    if (!entity) continue;
    ours.add(entity.id);
    system.runTimeout(() => ours.delete(entity.id), 5);
  }
}

export function dropRandom(dim, center, blockId) {
  const s = settings();
  const now = system.currentTick;
  const amount = s.dropAmount * (temp.doubleUntil > now ? 2 : 1);

  if (temp.midasUntil > now) {
    for (let i = 0; i < amount; i++) spawnTracked(dim, pick(VALUABLES), center, 1);
    particle(dim, "minecraft:villager_happy", center);
    return;
  }
  if (s.dropMode === "shuffle") {
    spawnTracked(dim, shuffledItemFor(blockId), center, amount);
    return;
  }
  for (let i = 0; i < amount; i++) spawnTracked(dim, randomItemId(), center, 1);
}

// Drop bookkeeping for breaks another add-on cancelled (their after-event never fires).
system.runInterval(() => {
  const now = system.currentTick;
  for (const [key, info] of pending) {
    if (now - info.tick > 40) pending.delete(key);
  }
}, 200);
