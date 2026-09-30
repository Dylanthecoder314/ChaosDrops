// The Chaos Codex: settings, a drop lookup and the boss/recipe guide.
import { ActionFormData } from "@minecraft/server-ui";
import { settings, update } from "./settings.js";
import * as U from "./util.js";

let deps = {};
export function wireMenu(d) {
  deps = d;
}

const MODES = ["chaos", "shuffle", "vanilla"];
const MODE_LABEL = { chaos: "§dCHAOS §7(random every time)", shuffle: "§bSHUFFLE §7(each block has its own item)", vanilla: "§7VANILLA (off)" };
const EVENT_STEPS = [0, 3, 5, 8, 15];
const onOff = (v) => (v ? "§aON" : "§cOFF");

export function openMenu(player) {
  const s = settings();
  const form = new ActionFormData()
    .title("§d§lChaos Codex")
    .body(
      "§fBlock drops: " + MODE_LABEL[s.dropMode] +
      "\n§fDrops per block: §e" + s.dropAmount +
      "\n§fPlaced blocks drop themselves: " + onOff(s.placedDropSelf) +
      "\n§fChaos events: " + (s.eventMinutes ? `§eevery ${s.eventMinutes} min` : "§cOFF") +
      "\n§fSurprise bosses: " + onOff(s.surpriseBosses) +
      "\n\n§7Mob loot, chest loot, fishing and piglin bartering are always random.",
    )
    .button("Block drop mode", "textures/items/diamond_pickaxe")
    .button("Drops per block: " + s.dropAmount, "textures/items/diamond")
    .button("Placed blocks drop themselves: " + onOff(s.placedDropSelf), "textures/blocks/planks_oak")
    .button("Chaos event timer", "textures/items/clock_item")
    .button("Surprise bosses: " + onOff(s.surpriseBosses), "textures/items/nether_star")
    .button("What does this block drop?", "textures/items/spyglass")
    .button("Reshuffle drops (new seed)", "textures/blocks/tnt_side")
    .button("Start a chaos event now", "textures/items/fireworks")
    .button("Boss & recipe guide", "textures/items/book_enchanted")
    .button("Summon a boss (creative only)", "textures/items/egg_null");

  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined) return;
    switch (res.selection) {
      case 0:
        update({ dropMode: MODES[(MODES.indexOf(s.dropMode) + 1) % MODES.length] });
        break;
      case 1:
        update({ dropAmount: (s.dropAmount % 3) + 1 });
        break;
      case 2:
        update({ placedDropSelf: !s.placedDropSelf });
        break;
      case 3:
        update({ eventMinutes: EVENT_STEPS[(EVENT_STEPS.indexOf(s.eventMinutes) + 1) % EVENT_STEPS.length] });
        deps.resetEventTimer?.();
        break;
      case 4:
        update({ surpriseBosses: !s.surpriseBosses });
        break;
      case 5:
        return lookup(player);
      case 6:
        update({ seed: Math.floor(Math.random() * 2147483646) + 1 });
        U.broadcast(`§d[Chaos Drops] §e${player.name} reshuffled every block's drop!`);
        break;
      case 7:
        deps.triggerChaosEvent?.();
        return;
      case 8:
        return guide(player);
      case 9:
        return bossPicker(player);
    }
    openMenu(player);
  }).catch(() => {});
}

function lookup(player) {
  let hit;
  try {
    hit = player.getBlockFromViewDirection({ maxDistance: 8 });
  } catch {}
  const s = settings();
  let text;
  if (!hit?.block) text = "§7Look at a block (within 8 blocks) and try again.";
  else {
    const name = U.prettyName(hit.block.typeId);
    if (s.dropMode === "shuffle") text = `§f${name} §7drops §e${U.prettyName(deps.shuffledItemFor(hit.block.typeId))}`;
    else if (s.dropMode === "chaos") text = `§f${name} §7drops... §dANYTHING! §7(Chaos mode)`;
    else text = `§f${name} §7drops its normal item (drops are off).`;
  }
  U.tell(player, `§d[Chaos Codex] ${text}`);
}

const GUIDE = [
  "§l§dHOW IT WORKS§r",
  "§fBreaking blocks and defeating mobs drops random items. Chests, fishing and bartering are random too.",
  "",
  "§l§6CHAOS SHARDS§r",
  "§fThe key crafting item. Found as random drops, in Lucky Blocks, and from every boss.",
  "",
  "§l§aLOOT GOBLIN §r§7(mini-boss)",
  "§fRuns away, teleports when hit, and escapes after 2 minutes. Drops a big pile of loot.",
  "§7Goblin Bait: Gold Ingot + Chaos Shard + Bread (shapeless)",
  "",
  "§l§5CHAOS TITAN §r§7(400 HP)",
  "§fGround slams, evoker-fang eruptions, and summons minions when enraged. Drops a Titan Heart.",
  "§7Titan Core: Chaos Shards in the corners, Iron Ingots on the sides, Iron Block in the middle",
  "",
  "§l§3VOID WRAITH §r§7(300 HP, flies)",
  "§fShoots homing bullets, teleports, drags you into darkness. Drops Void Essence.",
  "§7Eye of the Void: Chaos Shards in the corners, Ender Pearls on the sides, Obsidian in the middle",
  "",
  "§l§6THE RANDOMIZER §r§7(600 HP, final boss)",
  "§fRolls a random attack every few seconds: lightning, arrow rain, swaps, curses and more. Drops the Dice of Destiny.",
  "§7Loaded Die: top & bottom rows Chaos Shards, middle row Titan Heart + Gold Block + Void Essence",
  "",
  "§l§eOTHER RECIPES§r",
  "§fLucky Block: 8 Gold Nuggets around a Chaos Shard",
  "§fChaos Blade: Chaos Shard / Diamond / Stick (vertical)",
  "§fChaos Apple (x2): Apple + Chaos Shard",
  "§fChaos Codex: Book + Chaos Shard",
  "",
  "§7Summon items are used on the ground like spawn eggs. Bosses get stronger below half health!",
].join("\n");

function guide(player) {
  new ActionFormData().title("§d§lBoss & Recipe Guide").body(GUIDE).button("Back").show(player)
    .then((res) => {
      if (!res.canceled) openMenu(player);
    })
    .catch(() => {});
}

const BOSSES = [["chaos_titan", "Chaos Titan"], ["void_wraith", "Void Wraith"], ["the_randomizer", "The Randomizer"],
  ["loot_goblin", "Loot Goblin"]];

function bossPicker(player) {
  if (!U.isCreative(player)) {
    U.tell(player, "§d[Chaos Codex] §7Switch to Creative mode to summon bosses from the menu. In Survival, craft the summon items!");
    return;
  }
  const form = new ActionFormData().title("§d§lSummon a Boss");
  for (const [, label] of BOSSES) form.button(label);
  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined) return;
    deps.spawnBossNear?.(player, BOSSES[res.selection][0]);
  }).catch(() => {});
}
