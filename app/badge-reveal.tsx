import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BadgeReveal } from "@/components/badge-reveal";
import { colors, theme } from "@/constants/theme";
import { markBadgeUnlockSeen } from "@/db/badges";
import type { BadgeTier } from "@/db/schema";
import type { BadgeId, BadgeUnlock } from "@/lib/badges";
import { badgeDefinitions } from "@/lib/badges";

const BADGE_TIERS: readonly BadgeTier[] = [
  "standard",
  "bronze",
  "silver",
  "gold",
];

function isBadgeTier(value: unknown): value is BadgeTier {
  return BADGE_TIERS.some((tier) => tier === value);
}

function isBadgeId(value: unknown): value is BadgeId {
  return badgeDefinitions.some((badge) => badge.id === value);
}

function parseUnlocks(value: string | undefined): BadgeUnlock[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (unlock): unlock is BadgeUnlock =>
        typeof unlock === "object" &&
        unlock !== null &&
        "badgeId" in unlock &&
        isBadgeId(unlock.badgeId) &&
        "key" in unlock &&
        typeof unlock.key === "string" &&
        "tier" in unlock &&
        isBadgeTier(unlock.tier),
    );
  } catch {
    return [];
  }
}

export default function BadgeRevealScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const {
    id,
    key,
    tier,
    unlocks: serializedUnlocks,
  } = useLocalSearchParams<{
    id?: string;
    key?: string;
    tier?: string;
    unlocks?: string;
  }>();
  const [unlockQueue] = useState(() => parseUnlocks(serializedUnlocks));
  const [activeIndex, setActiveIndex] = useState(0);
  const queuedUnlock = unlockQueue[activeIndex];
  const activeBadgeId = queuedUnlock?.badgeId ?? id;
  const activeTier = queuedUnlock?.tier ?? tier;
  const activeKey = queuedUnlock?.key ?? key;
  const badge = badgeDefinitions.find(
    (definition) => definition.id === activeBadgeId,
  );
  const badgeTier = BADGE_TIERS.find((candidate) => candidate === activeTier);

  const dismiss = async () => {
    if (activeKey) await markBadgeUnlockSeen(activeKey);
    if (activeIndex < unlockQueue.length - 1) {
      setActiveIndex((index) => index + 1);
      return;
    }
    if (router.canDismiss()) router.dismiss();
    else router.back();
  };

  if (!badge || !badgeTier) {
    return (
      <View style={styles.errorContainer}>
        <Text selectable style={styles.errorTitle}>
          {t("Badge unavailable")}
        </Text>
        <Text selectable style={styles.errorCopy}>
          {t("This badge reveal could not be loaded.")}
        </Text>
      </View>
    );
  }

  return (
    <BadgeReveal
      badge={badge}
      height={height}
      key={`${badge.id}:${badgeTier}`}
      onContinue={() => void dismiss()}
      tier={badgeTier}
      width={width}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  errorCopy: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  errorTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "800",
  },
});
