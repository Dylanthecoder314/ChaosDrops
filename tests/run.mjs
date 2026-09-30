// Drives the built scripts against the mock API.  Run after build.py:  node tests/run.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { S, world, system, advance, Dimension, Player, ItemStack } from "./mock/server.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const sandbox = path.join(root, "build", "test");

// ---- sandbox: built scripts + node_modules shims pointing at the mocks
fs.rmSync(sandbox, { recursive: true, force: true });
fs.cpSync(path.join(root, "build", "ChaosDrops_BP", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
fs.writeFileSync(path.join(sandbox, "package.json"), JSON.stringify({ type: "module" }));
for (const [name, file] of [["server", "server.mjs"], ["server-ui", "server-ui.mjs"]]) {
  const dir = path.join(sandbox, "node_modules", "@minecraft", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `@minecraft/${name}`, type: "module", main: "index.js" }));
  fs.writeFileSync(path.join(dir, "index.js"), `export * from ${JSON.stringify(pathToFileURL(path.join(here, "mock", file)).href)};\n`);
}

const failures = [];
const warnings = [];
console.warn = (...a) => warnings.push(a.join(" "));
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};
const flush = () => new Promise((r) => setTimeout(r, 0));

// ---- load (early execution: world APIs must not be touched at import time)
const overworld = new Dimension("minecraft:overworld");
new Dimension("minecraft:nether");
new Dimension("minecraft:the_end");
S.early = true;
await import(pathToFileURL(path.join(sandbox, "scripts", "main.js")).href);
S.early = false;
world.afterEvents.worldLoad.fire({});
advance(1);
check(typeof S.props["chaos:settings"] === "string", "settings saved on world load");

// ---- join
const alex = new Player("Alex", overworld, { x: 0.5, y: 64, z: 0.5 });
world.afterEvents.playerSpawn.fire({ player: alex, initialSpawn: true });
advance(70);
check(alex.inventory.includes("chaos:chaos_codex"), "new player receives the Chaos Codex");
check(alex.titles.some((t) => t.includes("CHAOS DROPS")), "welcome title shown");

// ---- block breaking
let blockX = 10;
function breakBlock(player, typeId, { contents = [], vanillaDrops = [typeId], place = false } = {}) {
  const loc = { x: blockX, y: 63, z: 0 };
  blockX += 10;
  const dim = player.dimension;
  const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 };
  dim.setBlockAt(loc, typeId);
  const bystander = dim.spawnItem(new ItemStack("minecraft:stick", 1), { x: center.x + 1, y: center.y, z: center.z });
  if (place) world.afterEvents.playerPlaceBlock.fire({ block: dim.getBlock(loc), player, dimension: dim });
  S.readOnly = true;
  world.beforeEvents.playerBreakBlock.fire({ block: dim.getBlock(loc), player, dimension: dim });
  S.readOnly = false;
  dim.setBlockAt(loc, "minecraft:air");
  const vanilla = [...vanillaDrops, ...contents].map((id) => dim.spawnItem(new ItemStack(id, 1), center));
  world.afterEvents.playerBreakBlock.fire({ block: dim.getBlock(loc), player, dimension: dim, brokenBlockPermutation: { type: { id: typeId } } });
  advance(3);
  const all = dim.getEntities({ type: "minecraft:item", location: center, maxDistance: 3 });
  const fresh = all.filter((e) => e !== bystander && !vanilla.includes(e));
  return { bystander, vanilla, fresh };
}
async function setSettings(patch) {
  // Go through the real settings module so its cache updates.
  const mod = await import(pathToFileURL(path.join(sandbox, "scripts", "settings.js")).href);
  mod.update(patch);
}

let r = breakBlock(alex, "minecraft:stone", { vanillaDrops: ["minecraft:cobblestone"] });
check(!r.vanilla[0].isValid, "chaos: vanilla cobblestone drop removed");
check(r.fresh.length === 1, `chaos: exactly one random drop (got ${r.fresh.length})`);
check(r.bystander.isValid, "chaos: unrelated nearby item untouched");

const seen = new Set();
for (let i = 0; i < 60; i++) seen.add(breakBlock(alex, "minecraft:dirt").fresh[0]?.itemStack.typeId);
check(seen.size > 30, `chaos: drops vary (${seen.size} distinct in 60 breaks)`);

r = breakBlock(alex, "minecraft:chest", { contents: ["minecraft:diamond", "minecraft:chest"] });
check(!r.vanilla[0].isValid, "container: the chest's own item is swapped out");
check(r.vanilla[1].isValid && r.vanilla[2].isValid, "container: contents are kept (even a chest inside the chest)");
check(r.fresh.length === 1, "container: plus one random item");

r = breakBlock(alex, "minecraft:oak_log", { place: true });
check(r.vanilla[0].isValid && r.fresh.length === 0, "placed blocks drop themselves");

r = breakBlock(alex, "minecraft:red_shulker_box");
check(r.vanilla[0].isValid && r.fresh.length === 0, "shulker boxes are never randomized");

alex.gameMode = "Creative";
r = breakBlock(alex, "minecraft:stone", { vanillaDrops: [] });
check(r.fresh.length === 0, "creative mode: no random drops");
alex.gameMode = "Survival";

await setSettings({ dropMode: "shuffle" });
const a = breakBlock(alex, "minecraft:gravel").fresh[0]?.itemStack.typeId;
const b = breakBlock(alex, "minecraft:gravel").fresh[0]?.itemStack.typeId;
const c = breakBlock(alex, "minecraft:sand").fresh[0]?.itemStack.typeId;
check(a && a === b, `shuffle: same block gives same item (${a} / ${b})`);
check(c !== undefined, "shuffle: other blocks drop too");

await setSettings({ dropMode: "chaos", dropAmount: 3 });
r = breakBlock(alex, "minecraft:stone");
check(r.fresh.length >= 1 && r.fresh.length <= 3, `drops per block 3 (got ${r.fresh.length} entities)`);
await setSettings({ dropAmount: 1, dropMode: "vanilla" });
r = breakBlock(alex, "minecraft:stone");
check(r.vanilla[0].isValid && r.fresh.length === 0, "vanilla mode leaves drops alone");
await setSettings({ dropMode: "chaos" });

// ---- lucky blocks (enough openings to hit all 24 outcomes)
const luckyTexts = new Set();
for (let i = 0; i < 400; i++) {
  alex.location = { x: 0.5, y: 64, z: 0.5 };
  r = breakBlock(alex, "chaos:lucky_block", { vanillaDrops: [] });
  luckyTexts.add(alex.actionbars.at(-1));
  advance(60);
}
check(luckyTexts.size >= 20, `lucky blocks: ${luckyTexts.size} different outcomes seen`);

// ---- bosses
function spawnViaCommand(name) {
  system.afterEvents.scriptEventReceive.fire({ id: "chaos:boss", message: name, sourceEntity: alex });
  advance(3);
  return [...overworld.entities].filter((e) => e.typeId === `chaos:${name}`).at(-1);
}
alex.location = { x: 0.5, y: 64, z: 0.5 };
const titan = spawnViaCommand("chaos_titan");
check(titan, "titan spawns from /scriptevent");
check(alex.titles.some((t) => t.includes("CHAOS TITAN")), "boss intro title shown");
titan.location = { x: 3, y: 64, z: 0.5 };
advance(400);
check(S.log.includes("anim animation.chaos.chaos_titan.slam"), "titan ground slam fires");
check(alex.hp.currentValue < 20, "titan slam damages nearby players");
titan.hp.currentValue = 150;
advance(420);
check(alex.titles.some((t) => t.includes("ENRAGED")), "titan enrage announced");
check(S.spawned.some((id) => ["minecraft:husk", "minecraft:skeleton", "minecraft:stray"].includes(id)), "enraged titan summons minions");
world.afterEvents.entityDie.fire({ deadEntity: titan, damageSource: { damagingEntity: alex } });
check(S.chat.some((m) => m.includes("Alex defeated") && m.includes("Chaos Titan")), "boss defeat announced");
titan.remove();

const wraith = spawnViaCommand("void_wraith");
const start = { ...wraith.location };
advance(600);
check(wraith.location.x !== start.x || wraith.location.z !== start.z, "wraith blinks around");
check(alex.effects.includes("darkness"), "wraith void pull applies darkness");
wraith.hp.currentValue = 10;
advance(500);
check(S.spawned.includes("minecraft:vex"), "enraged wraith summons vexes");
wraith.remove();

const randomizer = spawnViaCommand("the_randomizer");
randomizer.location = { x: 4, y: 66, z: 0.5 };
for (let i = 0; i < 100; i++) {
  advance(100);
  alex.location = { x: 0.5, y: 64, z: 0.5 };
  randomizer.location = { x: 4, y: 66, z: 0.5 };
  alex.hp.currentValue = 20;
}
const rolled = new Set(alex.actionbars.filter((t) => t.includes("rolled")).map((t) => t.split("§l")[1]));
check(rolled.size >= 8, `randomizer used ${rolled.size} different attacks: ${[...rolled].join(", ")}`);
randomizer.remove();

const goblin = spawnViaCommand("loot_goblin");
for (let i = 0; i < 20; i++) world.afterEvents.entityHurt.fire({ hurtEntity: goblin, damage: 1 });
check(overworld.getEntities({ type: "minecraft:item" }).some((e) => e.itemStack.typeId === "minecraft:gold_nugget"), "goblin drops gold nuggets when hit");
advance(2500);
check(!goblin.isValid, "goblin escapes after 2 minutes");

// ---- chaos events
await setSettings({ surpriseBosses: true });
const eventNames = new Set();
for (let i = 0; i < 150; i++) {
  system.afterEvents.scriptEventReceive.fire({ id: "chaos:event", message: "", sourceEntity: alex });
  eventNames.add(alex.titles.at(-1));
  advance(300);
  for (const e of [...overworld.entities]) if (e.families.length) e.remove();
}
check(eventNames.size >= 11, `chaos events: ${eventNames.size} kinds seen`);
await setSettings({ eventMinutes: 3 });
const before = alex.titles.length;
advance(3 * 1200 + 20);
check(alex.titles.slice(before).some((t) => t.includes("CHAOS EVENT")), "timed chaos event fires");

// ---- items
world.afterEvents.itemCompleteUse.fire({ source: alex, itemStack: new ItemStack("chaos:chaos_apple") });
check(alex.actionbars.at(-1).includes("Chaos Apple"), "chaos apple grants effects");
alex.mainhand = new ItemStack("chaos:chaos_blade");
const dummy = overworld.spawnEntity("minecraft:zombie", { x: 2, y: 64, z: 2 });
for (let i = 0; i < 100; i++) world.afterEvents.entityHitEntity.fire({ damagingEntity: alex, hitEntity: dummy });
check(dummy.effects.length > 0, "chaos blade applies random effects");
for (let i = 0; i < 30; i++) {
  world.afterEvents.itemUse.fire({ source: alex, itemStack: new ItemStack("chaos:dice_of_destiny") });
  advance(620);
}
check(alex.titles.filter((t) => t.includes("§6§l")).length >= 30, "dice of destiny rolls");

// ---- codex menu: cycle every setting, then lookup, guide, boss picker
S.formQueue.push(0, 1, 2, 3, 4, 6);
world.afterEvents.itemUse.fire({ source: alex, itemStack: new ItemStack("chaos:chaos_codex") });
for (let i = 0; i < 10; i++) await flush();
const s = JSON.parse(S.props["chaos:settings"]);
check(s.dropMode === "shuffle" && s.dropAmount === 2 && s.placedDropSelf === false && s.eventMinutes === 5 && s.surpriseBosses === false,
  `menu toggles settings (${JSON.stringify(s)})`);
alex.lookBlock = overworld.getBlock({ x: 0, y: 63, z: 0 });
S.formQueue.push(5);
advance(20);
world.afterEvents.itemUse.fire({ source: alex, itemStack: new ItemStack("chaos:chaos_codex") });
for (let i = 0; i < 10; i++) await flush();
check(alex.messages.at(-1).includes("Stone") && alex.messages.at(-1).includes("drops"), `block lookup: ${alex.messages.at(-1)}`);
S.formQueue.push(8, 0);
advance(20);
world.afterEvents.itemUse.fire({ source: alex, itemStack: new ItemStack("chaos:chaos_codex") });
for (let i = 0; i < 10; i++) await flush();
check(S.forms.some((f) => f.title.includes("Guide") && f.body.includes("RANDOMIZER")), "guide opens");
alex.gameMode = "Creative";
S.formQueue.push(9, 3);
advance(20);
world.afterEvents.itemUse.fire({ source: alex, itemStack: new ItemStack("chaos:chaos_codex") });
for (let i = 0; i < 10; i++) await flush();
advance(5);
check([...overworld.entities].some((e) => e.typeId === "chaos:loot_goblin"), "creative boss picker summons");
S.formQueue.length = 0;

// ---- report
advance(100);
for (const w of warnings) failures.push(`warning: ${w}`);
if (failures.length) {
  console.log(`FAILED (${failures.length}):`);
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}
console.log("All script checks passed.");
console.log(`  lucky outcomes seen: ${luckyTexts.size}, randomizer attacks: ${rolled.size}, chaos events: ${eventNames.size}`);
