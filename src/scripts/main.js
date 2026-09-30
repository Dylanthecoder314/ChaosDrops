// Chaos Drops entry point.
import { world, system } from "@minecraft/server";
import { settings } from "./settings.js";
import { randomItemId, shuffledItemFor } from "./drops.js";
import { wireLucky } from "./lucky.js";
import { spawnBossNear, wireBosses } from "./bosses.js";
import { resetEventTimer, triggerChaosEvent, wireEvents } from "./events.js";
import { giveStarterCodex, wireItems } from "./items.js";
import { openMenu, wireMenu } from "./menu.js";
import * as U from "./util.js";

wireLucky({ randomItemId, spawnBossNear });
wireBosses({ randomItemId });
wireEvents({ randomItemId, spawnBossNear });
wireItems({ randomItemId });
wireMenu({ shuffledItemFor, spawnBossNear, triggerChaosEvent, resetEventTimer });

// World APIs are unavailable while scripts first load; wait for the world.
function init() {
  settings();
}
if (world.afterEvents.worldLoad) world.afterEvents.worldLoad.subscribe(init);
else system.run(init);

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    if (!U.isValid(player)) return;
    U.title(player, "§d§lCHAOS DROPS", "§eEvery drop is random!");
    U.tell(player, "§d[Chaos Drops] §fEvery block you break and every mob you defeat drops something §drandom§f!");
    U.tell(player, "§d[Chaos Drops] §7Right-click the §dChaos Codex§7 for settings, the boss guide and recipes.");
    giveStarterCodex(player);
  }, 60);
});

// /scriptevent chaos:menu | chaos:event | chaos:boss <chaos_titan|void_wraith|the_randomizer|loot_goblin> | chaos:lucky
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
  const player = sourceEntity?.typeId === "minecraft:player" ? sourceEntity : world.getAllPlayers()[0];
  switch (id) {
    case "chaos:menu":
      if (player) openMenu(player);
      break;
    case "chaos:event":
      triggerChaosEvent();
      break;
    case "chaos:boss":
      if (player && !spawnBossNear(player, (message || "chaos_titan").trim())) {
        U.tell(player, "§cUnknown boss. Try: chaos_titan, void_wraith, the_randomizer, loot_goblin");
      }
      break;
    case "chaos:lucky":
      if (player) U.giveItem(player, "chaos:lucky_block", 16);
      break;
  }
});
