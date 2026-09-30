// A small fake of @minecraft/server, just enough to drive the add-on's scripts in Node.
// It enforces the two rules that most often break real add-ons:
//   - world APIs throw while scripts are first loading ("early execution")
//   - world writes throw inside before-events ("read-only mode")
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const vanilla = JSON.parse(fs.readFileSync(path.join(here, "../../data/vanilla_items.json"), "utf8")).items.map((x) => x[0]);
const custom = ["chaos_shard", "chaos_codex", "titan_core", "void_eye", "loaded_die", "goblin_bait", "titan_heart",
  "void_essence", "dice_of_destiny", "chaos_blade", "chaos_apple", "lucky_block"].map((n) => `chaos:${n}`);

export const S = (globalThis.__mc = {
  tick: 0, timers: [], intervals: [], queue: [], props: {}, dims: {}, players: [], chat: [], log: [],
  forms: [], formQueue: [], spawned: [], itemIds: new Set([...vanilla, ...custom, "minecraft:book"]),
  nextId: 1, early: false, readOnly: false,
});

function guardRead(what) {
  if (S.early) throw new Error(`${what} called during early execution`);
}
function guardWrite(what) {
  guardRead(what);
  if (S.readOnly) throw new Error(`${what} called in read-only mode`);
}
function checkLoc(loc, what) {
  if (!loc || [loc.x, loc.y, loc.z].some((v) => typeof v !== "number" || Number.isNaN(v))) {
    throw new Error(`${what}: bad location ${JSON.stringify(loc)}`);
  }
}

class Signal {
  constructor(deferred = false) {
    this.subs = [];
    this.deferred = deferred;
  }
  subscribe(cb) {
    this.subs.push(cb);
    return cb;
  }
  unsubscribe(cb) {
    this.subs = this.subs.filter((s) => s !== cb);
  }
  fire(ev) {
    if (this.deferred) S.queue.push(() => this.subs.forEach((cb) => cb(ev)));
    else this.subs.forEach((cb) => cb(ev));
  }
}

const NON_STACK = /sword|pickaxe|_axe|shovel|_hoe|helmet|chestplate|leggings|boots|bow|shield|codex|blade|dice_of_destiny|elytra|totem|potion|_bucket|^minecraft:bucket|saddle|trident|mace|armor|spear|_bed|^minecraft:bed$|boat|raft|minecart|music_disc|fishing_rod|shears|flint_and_steel|spyglass|brush|bundle|harness|goat_horn|stick$|_on_a_stick/;

export class ItemStack {
  constructor(typeId, amount = 1) {
    if (!S.itemIds.has(typeId)) throw new Error(`Invalid item identifier '${typeId}'`);
    this.typeId = typeId;
    this.maxAmount = NON_STACK.test(typeId) && !typeId.endsWith("stick") ? 1 : 64;
    this._amount = 1;
    this.amount = amount;
  }
  get amount() {
    return this._amount;
  }
  set amount(v) {
    if (!Number.isInteger(v) || v < 1 || v > this.maxAmount) throw new Error(`bad amount ${v} for ${this.typeId}`);
    this._amount = v;
  }
  getComponent() {
    return undefined;
  }
}

const FAMILIES = {
  "chaos:chaos_titan": ["chaos_boss"], "chaos:void_wraith": ["chaos_boss"], "chaos:the_randomizer": ["chaos_boss"],
  "chaos:loot_goblin": ["chaos_goblin"],
};

export class Entity {
  constructor(typeId, dim, loc) {
    checkLoc(loc, `spawn ${typeId}`);
    this.id = String(S.nextId++);
    this.typeId = typeId;
    this.dimension = dim;
    this.location = { ...loc };
    this._valid = true;
    this.tags = new Set();
    this.effects = [];
    this.families = FAMILIES[typeId] ?? [];
    const max = typeId === "chaos:the_randomizer" ? 600 : typeId === "chaos:chaos_titan" ? 400 : 100;
    this.hp = { currentValue: max, effectiveMax: max, setCurrentValue(v) { guardWrite("setCurrentValue"); this.currentValue = v; } };
  }
  get isValid() {
    return this._valid;
  }
  getComponent(id) {
    if (id === "minecraft:health") return this.hp;
    if (id === "minecraft:item") return this.itemStack ? { itemStack: this.itemStack } : undefined;
    if (id === "minecraft:tameable") return { tame: () => true };
    return undefined;
  }
  addEffect(id, duration, opts) {
    guardWrite("addEffect");
    if (typeof id !== "string" || !Number.isInteger(duration) || duration <= 0) throw new Error(`addEffect(${id}, ${duration})`);
    if (opts && typeof opts.amplifier !== "number") throw new Error("addEffect amplifier");
    this.effects.push(id);
  }
  applyDamage(amount, opts) {
    guardWrite("applyDamage");
    if (opts && opts.cause !== "entityAttack") throw new Error("applyDamage cause");
    this.hp.currentValue -= amount;
    return true;
  }
  applyKnockback(h, v) {
    guardWrite("applyKnockback");
    if (typeof h !== "object" || typeof v !== "number" || Number.isNaN(h.x) || Number.isNaN(h.z)) throw new Error("applyKnockback(VectorXZ, number)");
  }
  applyImpulse(v) {
    guardWrite("applyImpulse");
    checkLoc(v, "applyImpulse");
  }
  teleport(loc) {
    guardWrite("teleport");
    checkLoc(loc, "teleport");
    this.location = { ...loc };
  }
  remove() {
    guardWrite("remove");
    this._valid = false;
    this.dimension.entities.delete(this);
  }
  playAnimation(name) {
    S.log.push(`anim ${name}`);
  }
  hasTag(t) {
    return this.tags.has(t);
  }
  addTag(t) {
    guardWrite("addTag");
    this.tags.add(t);
    return true;
  }
}

export class Player extends Entity {
  constructor(name, dim, loc) {
    super("minecraft:player", dim, loc);
    this.name = name;
    this.gameMode = "Survival";
    this.inventory = [];
    this.messages = [];
    this.titles = [];
    this.actionbars = [];
    this.hp = { currentValue: 20, effectiveMax: 20, setCurrentValue(v) { this.currentValue = v; } };
    this.onScreenDisplay = {
      setTitle: (t, o) => this.titles.push(`${t} | ${o?.subtitle ?? ""}`),
      setActionBar: (t) => this.actionbars.push(t),
    };
    dim.entities.add(this);
    S.players.push(this);
  }
  getGameMode() {
    return this.gameMode;
  }
  sendMessage(m) {
    this.messages.push(m);
  }
  playSound() {}
  getComponent(id) {
    if (id === "minecraft:inventory") return { container: { addItem: (s) => { guardWrite("addItem"); this.inventory.push(s.typeId); } } };
    if (id === "minecraft:equippable") {
      return { getEquipment: (slot) => { if (slot !== "Mainhand") throw new Error("slot"); return this.mainhand; } };
    }
    return super.getComponent(id);
  }
  getBlockFromViewDirection() {
    return this.lookBlock ? { block: this.lookBlock } : undefined;
  }
}

class Block {
  constructor(dim, loc) {
    this.dimension = dim;
    this.location = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
    Object.assign(this, this.location);
  }
  get typeId() {
    return this.dimension.blockAt(this.location);
  }
  get isAir() {
    return this.typeId === "minecraft:air";
  }
  get isLiquid() {
    return /water|lava/.test(this.typeId);
  }
  setType(t) {
    guardWrite("setType");
    if (typeof t !== "string") throw new Error("setType");
    this.dimension.setBlockAt(this.location, t);
  }
  getComponent(id) {
    if (id === "minecraft:inventory" && ["minecraft:chest", "minecraft:barrel"].includes(this.typeId)) return { container: {} };
    return undefined;
  }
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class Dimension {
  constructor(id) {
    this.id = id;
    this.entities = new Set();
    this.blocks = new Map();
    S.dims[id] = this;
  }
  key(l) {
    return `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;
  }
  blockAt(l) {
    const k = this.key(l);
    if (this.blocks.has(k)) return this.blocks.get(k);
    return Math.floor(l.y) < 64 ? "minecraft:stone" : "minecraft:air";
  }
  setBlockAt(l, t) {
    this.blocks.set(this.key(l), t);
  }
  getBlock(l) {
    guardRead("getBlock");
    checkLoc(l, "getBlock");
    return new Block(this, l);
  }
  getEntities(o = {}) {
    guardRead("getEntities");
    return [...this.entities].filter((e) =>
      (!o.type || e.typeId === o.type) &&
      (!o.families || o.families.some((f) => e.families.includes(f))) &&
      (!o.location || dist(e.location, o.location) <= (o.maxDistance ?? Infinity)));
  }
  getPlayers(o = {}) {
    return this.getEntities({ ...o, type: "minecraft:player" });
  }
  spawnItem(stack, loc) {
    guardWrite("spawnItem");
    if (!(stack instanceof ItemStack)) throw new Error("spawnItem needs ItemStack");
    const e = new Entity("minecraft:item", this, loc);
    e.itemStack = stack;
    this.entities.add(e);
    return e;
  }
  spawnEntity(id, loc) {
    guardWrite("spawnEntity");
    const e = new Entity(id, this, loc);
    this.entities.add(e);
    S.spawned.push(id);
    world.afterEvents.entitySpawn.fire({ entity: e, cause: "Spawned" });
    return e;
  }
  spawnParticle(id, loc) {
    guardWrite("spawnParticle");
    checkLoc(loc, `particle ${id}`);
  }
  playSound(id, loc) {
    checkLoc(loc, `sound ${id}`);
  }
  createExplosion(loc) {
    guardWrite("createExplosion");
    checkLoc(loc, "explosion");
    S.log.push("explosion");
    return true;
  }
  setWeather(type) {
    guardWrite("setWeather");
    if (!["Clear", "Rain", "Thunder"].includes(type)) throw new Error(`weather ${type}`);
    S.log.push(`weather ${type}`);
  }
}

export const world = {
  afterEvents: Object.fromEntries(["worldLoad", "playerSpawn", "playerBreakBlock", "playerPlaceBlock", "entityDie",
    "entityHurt", "entityHitEntity", "itemUse", "itemCompleteUse"].map((n) => [n, new Signal()]).concat([["entitySpawn", new Signal(true)]])),
  beforeEvents: { playerBreakBlock: new Signal() },
  getDynamicProperty(k) {
    guardRead("getDynamicProperty");
    return S.props[k];
  },
  setDynamicProperty(k, v) {
    guardWrite("setDynamicProperty");
    if (typeof v === "string" && v.length > 32767) throw new Error("dynamic property too long");
    S.props[k] = v;
  },
  getAllPlayers() {
    guardRead("getAllPlayers");
    return S.players.filter((p) => p.isValid);
  },
  getDimension(id) {
    guardRead("getDimension");
    if (!S.dims[id]) throw new Error(`no dimension ${id}`);
    return S.dims[id];
  },
  sendMessage(m) {
    S.chat.push(m);
  },
};

function schedule(cb, delay) {
  S.timers.push({ cb, at: S.tick + Math.max(1, delay) });
}

export const system = {
  get currentTick() {
    return S.tick;
  },
  run: (cb) => schedule(cb, 1),
  runTimeout: (cb, d = 1) => schedule(cb, d),
  runInterval: (cb, every = 1) => S.intervals.push({ cb, every }),
  afterEvents: { scriptEventReceive: new Signal() },
};

export function advance(ticks = 1) {
  for (let i = 0; i < ticks; i++) {
    S.tick++;
    const due = S.timers.filter((t) => t.at <= S.tick);
    S.timers = S.timers.filter((t) => t.at > S.tick);
    due.forEach((t) => t.cb());
    S.intervals.forEach((iv) => {
      if (S.tick % iv.every === 0) iv.cb();
    });
    const q = S.queue;
    S.queue = [];
    q.forEach((f) => f());
  }
}

export const GameMode = { Creative: "Creative", Survival: "Survival", Adventure: "Adventure", Spectator: "Spectator" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
