// Scripted boss abilities layered on top of the data-driven AI in the entity files.
import { world, system } from "@minecraft/server";
import * as U from "./util.js";

export const TITAN = "chaos:chaos_titan";
export const WRAITH = "chaos:void_wraith";
export const RANDOMIZER = "chaos:the_randomizer";
export const GOBLIN = "chaos:loot_goblin";

export const BOSS_INFO = {
  [TITAN]: { name: "Chaos Titan", color: "§5", intro: "§dThe ground begins to shake..." },
  [WRAITH]: { name: "Void Wraith", color: "§3", intro: "§bThe shadows are watching you..." },
  [RANDOMIZER]: { name: "The Randomizer", color: "§6", intro: "§eLet's roll the dice!" },
  [GOBLIN]: { name: "Loot Goblin", color: "§a", intro: "§eCatch it before it escapes!", mini: true },
};

const HOSTILES = ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider", "minecraft:husk", "minecraft:witch",
  "minecraft:slime", "minecraft:stray", "minecraft:creeper"];
const CURSES = [["slowness", 1], ["weakness", 1], ["mining_fatigue", 1], ["poison", 0], ["hunger", 2],
  ["blindness", 0], ["nausea", 0]];

let randomItemId = () => "minecraft:diamond";
export function wireBosses(deps) {
  randomItemId = deps.randomItemId;
}

const state = new Map();

function ready(st, key, now, cooldown) {
  if ((st.next[key] ?? 0) > now) return false;
  st.next[key] = now + cooldown;
  return true;
}

function nearestTarget(dim, loc, radius) {
  const players = U.playersNear(dim, loc, radius);
  let best;
  let bestD = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.location.x - loc.x, p.location.y - loc.y, p.location.z - loc.z);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function tellNear(dim, loc, text, radius = 48) {
  for (const p of U.allPlayersNear(dim, loc, radius)) U.actionbar(p, text);
}

// ------------------------------------------------------------------ Chaos Titan

function titan(boss, dim, now, st) {
  const loc = boss.location;
  if (U.playersNear(dim, loc, 8).length && ready(st, "slam", now, st.enraged ? 90 : 140)) {
    try {
      boss.playAnimation("animation.chaos.chaos_titan.slam");
    } catch {}
    U.sound(dim, "mob.ravager.roar", loc, { volume: 1.5, pitch: 0.7 });
    tellNear(dim, loc, "§c!! The Chaos Titan raises its fists !!", 16);
    system.runTimeout(() => {
      if (!U.isValid(boss)) return;
      const at = boss.location;
      U.particle(dim, "minecraft:huge_explosion_emitter", at);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        U.particle(dim, "minecraft:knockback_roar_particle", U.offset(at, Math.cos(a) * 4, 0.3, Math.sin(a) * 4));
      }
      U.sound(dim, "random.explode", at, { volume: 1.5, pitch: 0.6 });
      for (const p of U.playersNear(dim, at, 7)) {
        U.damage(p, st.enraged ? 10 : 7, boss);
        U.knockback(p, p.location.x - at.x, p.location.z - at.z, 2.4, 0.75);
      }
    }, 16);
  }
  if (st.enraged && ready(st, "minions", now, 400)) {
    if (U.countNear(dim, loc, ["minecraft:husk", "minecraft:skeleton", "minecraft:stray"], 24) < 6) {
      for (let i = 0; i < 2; i++) {
        const spot = U.spotAround(dim, loc, 3, 6);
        if (!spot) continue;
        U.spawnEntity(dim, U.pick(["minecraft:husk", "minecraft:skeleton", "minecraft:stray"]), spot);
        U.burst(dim, "minecraft:mob_portal", spot, 6, 0.6);
      }
      tellNear(dim, loc, "§5The Chaos Titan calls for help!", 32);
    }
  }
}

// ------------------------------------------------------------------ Void Wraith

function wraith(boss, dim, now, st) {
  const loc = boss.location;
  const target = nearestTarget(dim, loc, 32);
  if (!target) return;

  if (ready(st, "blink", now, st.enraged ? 120 : 180)) {
    const tl = target.location;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = U.rand(6, 10);
      const pos = { x: tl.x + Math.cos(a) * r, y: tl.y + U.rand(2.5, 5), z: tl.z + Math.sin(a) * r };
      if (!U.isAirAt(dim, pos) || !U.isAirAt(dim, U.offset(pos, 0, 1, 0)) || !U.isAirAt(dim, U.offset(pos, 0, 2, 0))) continue;
      U.burst(dim, "minecraft:dragon_breath_trail", loc, 12, 1);
      U.sound(dim, "mob.endermen.portal", loc);
      try {
        boss.teleport(pos, { facingLocation: tl });
      } catch {}
      U.burst(dim, "minecraft:dragon_breath_trail", pos, 12, 1);
      break;
    }
  }
  if (ready(st, "pull", now, st.enraged ? 200 : 260)) {
    const victims = U.playersNear(dim, loc, 18);
    if (victims.length) {
      U.sound(dim, "mob.endermen.stare", loc, { volume: 1.2, pitch: 0.5 });
      for (const p of victims) {
        U.knockback(p, loc.x - p.location.x, loc.z - p.location.z, 1.7, 0.35);
        U.effect(p, "darkness", 4);
        U.actionbar(p, "§5The Void Wraith drags you into the dark!");
      }
    }
  }
  if (st.enraged && ready(st, "vex", now, 400) && U.countNear(dim, loc, ["minecraft:vex"], 24) < 4) {
    for (let i = 0; i < 2; i++) U.spawnEntity(dim, "minecraft:vex", U.offset(loc, U.rand(-2, 2), 1, U.rand(-2, 2)));
    tellNear(dim, loc, "§3Shades pour out of the Void Wraith!", 32);
  }
}

// ------------------------------------------------------------------ The Randomizer

const ROLLS = [
  { w: 3, name: "LIGHTNING STORM", run(boss, dim, players) {
    for (const p of players) {
      for (let i = 0; i < 3; i++) {
        system.runTimeout(() => {
          if (U.isValid(p)) U.spawnEntity(dim, "minecraft:lightning_bolt", U.offset(p.location, U.rand(-3, 3), 0, U.rand(-3, 3)));
        }, 10 + i * 8);
      }
    }
  } },
  { w: 3, name: "MOB ROULETTE", run(boss, dim, players) {
    const p = U.pick(players);
    for (let i = 0; i < 2; i++) {
      const spot = U.spotAround(dim, p.location, 3, 6);
      if (spot) U.spawnEntity(dim, U.pick(HOSTILES), spot);
    }
  } },
  { w: 3, name: "ARROW RAIN", run(boss, dim, players) {
    for (const p of players) {
      for (let i = 0; i < 12; i++) {
        system.runTimeout(() => {
          if (U.isValid(p)) U.spawnEntity(dim, "minecraft:arrow", U.offset(p.location, U.rand(-3, 3), 10 + U.rand(0, 3), U.rand(-3, 3)));
        }, i * 2);
      }
    }
  } },
  { w: 2, name: "GRAVITY FLIP", run(boss, dim, players) {
    for (const p of players) U.effect(p, "levitation", 3, 1);
  } },
  { w: 2, name: "SWAP!", run(boss, dim, players) {
    const p = U.pick(players);
    const a = boss.location;
    const b = p.location;
    try {
      boss.teleport(b);
      p.teleport(a);
    } catch {}
    U.sound(dim, "mob.endermen.portal", b);
  } },
  { w: 3, name: "CURSE ROULETTE", run(boss, dim, players) {
    for (const p of players) {
      const [id, amp] = U.pick(CURSES);
      U.effect(p, id, 6, amp);
    }
  } },
  { w: 2, name: "DOUBLE OR NOTHING", run(boss, dim, players) {
    const hp = U.health(boss);
    if (!hp) return;
    const delta = hp.effectiveMax * 0.08;
    if (U.chance(0.5)) {
      hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + delta));
      for (const p of players) U.tell(p, "§6[The Randomizer] §cThe dice favor me! §7(healed)");
    } else {
      hp.setCurrentValue(Math.max(1, hp.currentValue - delta));
      for (const p of players) U.tell(p, "§6[The Randomizer] §aSnake eyes! §7(it hurt itself)");
    }
  } },
  { w: 2, name: "BOOM BOX", run(boss, dim, players) {
    for (const p of players) {
      for (let i = 0; i < 3; i++) {
        const at = U.offset(p.location, U.rand(-4, 4), 0.5, U.rand(-4, 4));
        U.burst(dim, "minecraft:lava_particle", at, 4, 0.3);
        system.runTimeout(() => {
          try {
            dim.createExplosion(at, 2.5, { breaksBlocks: false, causesFire: false, source: boss });
          } catch {}
        }, 25);
      }
    }
  } },
  { w: 1, name: "A GIFT?!", run(boss, dim, players) {
    for (const p of players) U.spawnStack(dim, randomItemId(), p.location, 1);
  } },
];

function randomizer(boss, dim, now, st) {
  const players = U.playersNear(dim, boss.location, 24);
  if (!players.length || !ready(st, "roll", now, st.enraged ? 60 : 100)) return;
  const roll = U.weightedPick(ROLLS);
  try {
    boss.playAnimation("animation.chaos.the_randomizer.cast");
  } catch {}
  for (const p of U.allPlayersNear(dim, boss.location, 32)) {
    U.actionbar(p, `§6[The Randomizer] §erolled §l${roll.name}`);
    U.playerSound(p, "note.pling", { pitch: U.rand(0.6, 1.8) });
  }
  try {
    roll.run(boss, dim, players);
  } catch (e) {
    console.warn(`[Chaos Drops] randomizer ${roll.name}: ${e}`);
  }
}

// ------------------------------------------------------------------ Loot Goblin

const GOBLIN_LIFETIME = 2400;

function goblin(g, dim, now, st) {
  if (now - st.born > GOBLIN_LIFETIME) {
    const loc = g.location;
    U.burst(dim, "minecraft:mob_portal", loc, 12, 0.8);
    U.sound(dim, "mob.endermen.portal", loc);
    tellNear(dim, loc, "§eThe Loot Goblin escaped with its treasure!", 32);
    try {
      g.remove();
    } catch {}
    return;
  }
  if (ready(st, "trail", now, 60)) U.spawnStack(dim, "minecraft:gold_nugget", g.location, 1, false);
}

world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
  if (hurtEntity?.typeId !== GOBLIN) return;
  const dim = hurtEntity.dimension;
  const loc = hurtEntity.location;
  U.spawnStack(dim, "minecraft:gold_nugget", loc, U.rint(1, 3));
  if (U.chance(0.08)) U.spawnStack(dim, "minecraft:emerald", loc, 1);
  if (U.chance(0.3)) {
    const spot = U.spotAround(dim, loc, 5, 9);
    if (!spot) return;
    U.burst(dim, "minecraft:mob_portal", loc, 8, 0.6);
    try {
      hurtEntity.teleport(spot);
    } catch {}
    U.sound(dim, "mob.endermen.portal", spot);
  }
});

// ------------------------------------------------------------------ loop & announcements

function tick(boss, dim, now) {
  let st = state.get(boss.id);
  if (!st) {
    // Short grace period so nothing fires the instant a boss appears.
    st = { born: now, enraged: false, next: { slam: now + 80, blink: now + 100, pull: now + 160, roll: now + 60 } };
    state.set(boss.id, st);
  }
  if (boss.typeId !== GOBLIN && !st.enraged) {
    const hp = U.health(boss);
    if (hp && hp.currentValue <= hp.effectiveMax * 0.5) {
      st.enraged = true;
      const info = BOSS_INFO[boss.typeId];
      for (const p of U.allPlayersNear(dim, boss.location, 64)) U.title(p, `${info.color}§l${info.name.toUpperCase()}`, "§c§lis ENRAGED!");
      U.sound(dim, "mob.enderdragon.growl", boss.location);
    }
  }
  switch (boss.typeId) {
    case TITAN: return titan(boss, dim, now, st);
    case WRAITH: return wraith(boss, dim, now, st);
    case RANDOMIZER: return randomizer(boss, dim, now, st);
    case GOBLIN: return goblin(boss, dim, now, st);
  }
}

system.runInterval(() => {
  const now = system.currentTick;
  const alive = new Set();
  for (const dim of U.dimensions()) {
    let list = [];
    try {
      list = dim.getEntities({ families: ["chaos_boss"] }).concat(dim.getEntities({ families: ["chaos_goblin"] }));
    } catch {}
    for (const boss of list) {
      alive.add(boss.id);
      try {
        tick(boss, dim, now);
      } catch (e) {
        console.warn(`[Chaos Drops] ${boss.typeId}: ${e}`);
      }
    }
  }
  if (now % 200 === 0) {
    for (const id of state.keys()) if (!alive.has(id)) state.delete(id);
  }
}, 10);

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
  const info = BOSS_INFO[entity?.typeId];
  if (!info || String(cause).toLowerCase() === "loaded") return;
  system.runTimeout(() => {
    if (!U.isValid(entity)) return;
    const dim = entity.dimension;
    const loc = entity.location;
    for (const p of U.allPlayersNear(dim, loc, 64)) {
      if (info.mini) {
        U.actionbar(p, `§a§lA LOOT GOBLIN APPEARED! ${info.intro}`);
        U.playerSound(p, "random.orb", { pitch: 0.7 });
      } else {
        U.title(p, `${info.color}§l${info.name.toUpperCase()}`, info.intro);
        U.playerSound(p, "mob.wither.spawn", { volume: 0.7 });
      }
    }
  }, 2);
});

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  const info = BOSS_INFO[deadEntity?.typeId];
  if (!info) return;
  const killer = damageSource?.damagingEntity;
  const who = killer?.typeId === "minecraft:player" ? killer.name : "Someone";
  U.broadcast(`§6[Chaos Drops] §e${who} ${info.mini ? "caught the" : "defeated"} ${info.color}${info.name}§e!`);
  try {
    const dim = deadEntity.dimension;
    const loc = deadEntity.location;
    U.burst(dim, "minecraft:totem_particle", loc, info.mini ? 10 : 30, 1.5);
    U.sound(dim, info.mini ? "random.levelup" : "random.totem", loc);
  } catch {}
  state.delete(deadEntity.id);
});

// Used by chaos events, lucky blocks and /scriptevent chaos:boss <name>.
export function spawnBossNear(player, name) {
  const id = name.includes(":") ? name : `chaos:${name}`;
  if (!BOSS_INFO[id]) return false;
  const dim = player.dimension;
  const spot = U.spotAround(dim, player.location, 6, 10) ?? U.offset(player.location, 0, 1, 3);
  U.burst(dim, "minecraft:mob_portal", spot, 20, 1.2);
  return !!U.spawnEntity(dim, id, spot);
}
