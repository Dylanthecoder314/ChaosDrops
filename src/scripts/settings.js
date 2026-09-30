import { world } from "@minecraft/server";

const KEY = "chaos:settings";

export const DEFAULTS = {
  dropMode: "chaos", // chaos | shuffle | vanilla
  dropAmount: 1,
  placedDropSelf: true,
  eventMinutes: 8, // 0 = off
  surpriseBosses: false,
  seed: 0,
};

// Short-lived world modifiers started by chaos events (system ticks, not saved).
export const temp = { midasUntil: 0, doubleUntil: 0 };

let cache;

export function settings() {
  if (!cache) {
    cache = { ...DEFAULTS };
    try {
      const raw = world.getDynamicProperty(KEY);
      if (typeof raw === "string") Object.assign(cache, JSON.parse(raw));
    } catch {}
    if (!cache.seed) {
      cache.seed = Math.floor(Math.random() * 2147483646) + 1;
      save();
    }
  }
  return cache;
}

export function save() {
  try {
    world.setDynamicProperty(KEY, JSON.stringify(cache));
  } catch {}
}

export function update(patch) {
  Object.assign(settings(), patch);
  save();
}
