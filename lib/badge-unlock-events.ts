import type { BadgeUnlock } from "@/lib/badges";

type BadgeUnlockListener = (unlocks: readonly BadgeUnlock[]) => void;

const listeners = new Set<BadgeUnlockListener>();

export function publishBadgeUnlocks(unlocks: readonly BadgeUnlock[]) {
  if (unlocks.length === 0) return;
  for (const listener of listeners) listener(unlocks);
}

export function subscribeToBadgeUnlocks(listener: BadgeUnlockListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
