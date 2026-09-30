# Chaos Drops — a random-drops add-on for Minecraft Education

Every block you break, every mob you defeat, every chest you open and every fish you catch
gives you something **random**. On top of that there are four custom bosses, Lucky Blocks,
timed chaos events and new items.

Made for **Minecraft Education 1.21.90 or newer** and played on Education 1.26.32. It should
also work in regular Minecraft Bedrock (Windows, iPad, Android, consoles) 1.21.90 or newer.

## Install (about one minute)

1. Download **`ChaosDrops.mcaddon`** from the
   [latest release](https://github.com/Dylanthecoder314/ChaosDrops/releases/latest).
2. Double-click the file. Minecraft Education opens and imports it.
   (On a Mac, if it doesn't open, right-click the file → **Open With → minecraft-edu**.)
3. In Minecraft Education, go to **Play → Create New → Create New World**.
4. In the world settings, open **Behavior Packs** → **Available**, select
   **Chaos Drops (Behavior)**, and click **Activate**. The resource pack turns on with it.
5. Create the world. After a few seconds you'll see **CHAOS DROPS** on screen and get a
   **Chaos Codex** in your inventory.

To add it to an existing world, open that world's **Edit** screen and do step 4. Back up the
world first; add-ons change which items and mobs exist in it.

## What's in it

### Random drops
| What | How it's randomized |
|---|---|
| Breaking blocks | **Chaos** mode: a random item every time. **Shuffle** mode: each block type always drops the same random item (e.g. dirt → diamonds), and you can reshuffle. **Vanilla** turns it off. |
| Killing mobs | 1–2 random items (the Wither, Warden and Elder Guardian drop more) |
| Chests in structures | 4–8 random items, including trial-chamber vaults |
| Fishing, piglin bartering, cat gifts, sheep/mooshroom shearing, archaeology, sniffers | Random |

The random pool is 1,400+ real items taken from the game's own catalog, weighted so
tools, armor and treasure turn up more often than stairs and slabs. Blocks you place yourself
drop themselves again, so you can't farm one block by placing and breaking it. You can turn
this off in the Codex. Containers keep their contents, and shulker boxes are never touched.

### Bosses
Each boss has a boss bar and gets **enraged** below half health, which changes its texture and
makes it stronger.

| Boss | HP | Fight | Drops | Summon with |
|---|---|---|---|---|
| **Loot Goblin** (mini-boss) | 40 | Runs away, teleports when hit, leaves a trail of gold nuggets, and escapes after 2 minutes | 8–14 random items and Chaos Shards | **Goblin Bait**: Gold Ingot + Chaos Shard + Bread. It also spawns naturally now and then. |
| **Chaos Titan** | 400 | Ground slam shockwave, evoker-fang eruptions, summons minions when enraged | **Titan Heart**, iron, diamonds, lots of random loot | **Titan Core**: Chaos Shards in the corners, Iron Ingots on the sides, Iron Block in the centre |
| **Void Wraith** | 300 | Flies, fires homing shulker bullets (fireball bursts when enraged), teleports around you, pulls you into darkness, summons vexes | **Void Essence**, ender pearls, emeralds | **Eye of the Void**: Chaos Shards in the corners, Ender Pearls on the sides, Obsidian in the centre |
| **The Randomizer** (final boss) | 600 | A floating die. Every few seconds it rolls one of 9 attacks: lightning storm, arrow rain, mob roulette, gravity flip, position swap, curses, explosions, heal-or-hurt itself, or a gift | **Dice of Destiny**, a Nether Star, netherite, a totem, 20–30 random items | **Loaded Die**: top and bottom rows Chaos Shards; middle row Titan Heart, Gold Block, Void Essence |

Summon items work like spawn eggs: use them on the ground.

### Items and blocks
- **Chaos Shard**: the main crafting ingredient. You get it from random drops, Lucky Blocks and bosses.
- **Lucky Block**: break it for one of 24 outcomes, such as a diamond shower, a knight kit, a pet, a jackpot, lightning, an ambush, an anvil rain, a Loot Goblin or a random teleport. Recipe: 8 Gold Nuggets around a Chaos Shard.
- **Chaos Blade**: a 10-damage sword. Hits can poison, wither, slow or levitate the target, call lightning, or heal you. Recipe: Chaos Shard / Diamond / Stick (vertical).
- **Chaos Apple**: gives three random effects, mostly good. Recipe: Apple + Chaos Shard (makes 2).
- **Dice of Destiny**: roll 1–6 for a curse, loot, buffs or a jackpot. 30-second cooldown.
- **Chaos Codex**: settings menu, "what does this block drop?", and the full boss and recipe guide. Recipe: Book + Chaos Shard.

### Chaos events
Every 8 minutes by default (you can pick 3, 5, 8 or 15 minutes, or off), everyone gets one of
these: Item Rain, Lucky Delivery, Goblin Raid, Low Gravity, Speed Frenzy, Midas Touch
(blocks drop treasure), Double Drops, Mob Party, Thunderstorm, Feast or Blindfold. If
**Surprise bosses** is on, there's also a rare **Boss Omen**.

## Commands (need cheats on)
```
/scriptevent chaos:menu                  open the Codex menu
/scriptevent chaos:event                 start a chaos event now
/scriptevent chaos:boss chaos_titan      also: void_wraith, the_randomizer, loot_goblin
/scriptevent chaos:lucky                 get 16 Lucky Blocks
```
In Creative mode, the Codex also has a **Summon a boss** button.

## Troubleshooting
- **Mobs drop random loot but blocks don't, and there's no Codex:** the script part isn't
  running. Check that the behavior pack is active on the world, not only imported. Then turn
  on **Settings → Creator → Content Log GUI** and reload the world to see any errors.
- **Purple/black checkerboard textures:** the resource pack isn't active. Activate
  *Chaos Drops (Resources)* under **Resource Packs** in the world settings.
- **Classroom tip:** the fireball attacks can start fires. Use `/gamerule mobgriefing false`
  if you want to protect builds.

## Rebuilding from source
```
python3 build.py        # generates build/ and dist/*.mcaddon, validates every reference
node tests/run.mjs      # runs all scripts against a mock of the Minecraft API
```
- `src/scripts/`: gameplay scripts (drops, lucky blocks, bosses, events, items, menu)
- `tools/content.py`: entities, items, recipes, loot tables and manifests
- `tools/models.py`: boss models. Geometry, textures and animations are generated together.
- `tools/art.py`: item, block and pack-icon pixel art
- `tools/extract_game_data.py`: re-reads the item catalog and loot tables from an installed
  game (run it after Minecraft Education updates)

Pack versions are fixed UUIDs. To ship an update, bump `VERSION` in `tools/content.py`
before rebuilding.

## License
[MIT](LICENSE). Chaos Drops is a fan-made add-on and is not affiliated with or endorsed by
Mojang Studios or Microsoft. "Minecraft" is a trademark of Mojang Synergies AB.
