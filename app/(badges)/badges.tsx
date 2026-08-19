import { useQuery } from "@tanstack/react-query";
import { Link, useNavigation } from "expo-router";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BadgeMedallion } from "@/components/badge-medallion";
import { colors, theme } from "@/constants/theme";
import { getBadges } from "@/db/badges";
import type { BadgeProgress } from "@/lib/badges";
import type { TranslationKey } from "@/localization/resources";
import { createHeaderRightOptions } from "@/lib/header-item-options";
import {
  createFilterAction,
  createFilterSubmenu,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";

const HORIZONTAL_PADDING = theme.spacing.lg;
const COLUMN_GAP = 12;
type BadgeFilter = "all" | "earned" | "locked";
type BadgeSort = "default" | "progress" | "title";

export default function BadgesScreen() {
  const { i18n, t } = useTranslation();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const [sort, setSort] = useState<BadgeSort>("default");
  const badgesQuery = useQuery({
    queryFn: getBadges,
    queryKey: ["badges"],
  });
  const itemWidth = (width - HORIZONTAL_PADDING * 2 - COLUMN_GAP * 2) / 3;
  const badges = useMemo(() => {
    const filtered = (badgesQuery.data ?? []).filter((badge) => {
      const earned = badge.milestones.some((milestone) => milestone.unlocked);
      return (
        filter === "all" ||
        (filter === "earned" && earned) ||
        (filter === "locked" && !earned)
      );
    });

    if (sort === "default") return filtered;

    return [...filtered].sort((left, right) =>
      sort === "title"
        ? t(left.title as TranslationKey).localeCompare(
            t(right.title as TranslationKey),
            i18n.resolvedLanguage,
          )
        : right.progress - left.progress,
    );
  }, [badgesQuery.data, filter, i18n.resolvedLanguage, sort, t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createHeaderRightOptions(() => [
        createHeaderFilterMenu({
          active: filter !== "all" || sort !== "default",
          items: [
            createFilterSubmenu({
              icon: { name: "trophy", type: "sfSymbol" },
              label: t("Status"),
              items: [
                createFilterAction({
                  label: t("All badges"),
                  onPress: () => setFilter("all"),
                  selected: filter === "all",
                }),
                createFilterAction({
                  label: t("Earned"),
                  onPress: () => setFilter("earned"),
                  selected: filter === "earned",
                }),
                createFilterAction({
                  label: t("Not yet earned"),
                  onPress: () => setFilter("locked"),
                  selected: filter === "locked",
                }),
              ],
            }),
            createFilterSubmenu({
              icon: { name: "arrow.up.arrow.down", type: "sfSymbol" },
              label: t("Sort by"),
              items: [
                createFilterAction({
                  label: t("Badge path"),
                  onPress: () => setSort("default"),
                  selected: sort === "default",
                }),
                createFilterAction({
                  label: t("Closest to earning"),
                  onPress: () => setSort("progress"),
                  selected: sort === "progress",
                }),
                createFilterAction({
                  label: t("Title"),
                  onPress: () => setSort("title"),
                  selected: sort === "title",
                }),
              ],
            }),
          ],
          tintColor: colors.primary,
          title: t("Badge filters"),
        }),
      ]),
    });
  }, [filter, navigation, sort, t]);
  return (
    <FlatList
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={badges}
      keyExtractor={(badge) => badge.id}
      ListEmptyComponent={
        badgesQuery.isLoading ? null : (
          <Text style={styles.emptyText}>
            {badgesQuery.error instanceof Error
              ? badgesQuery.error.message
              : t("No badges available.")}
          </Text>
        )
      }
      numColumns={3}
      renderItem={({ item }) => <BadgeItem badge={item} width={itemWidth} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BadgeItem({ badge, width }: { badge: BadgeProgress; width: number }) {
  const { t } = useTranslation();
  const title = t(badge.title as TranslationKey);
  const unlockedMilestones = badge.milestones.filter(
    (milestone) => milestone.unlocked,
  );
  const highestMilestone = unlockedMilestones.at(-1) ?? null;
  const locked = highestMilestone === null;
  const tier = highestMilestone?.tier ?? badge.milestones[0].tier;
  const target =
    badge.nextMilestone?.target ?? badge.milestones.at(-1)?.target ?? 1;
  const progressLabel =
    badge.nextMilestone === null
      ? t("Unlocked")
      : `${Math.min(badge.current, target)} / ${target}`;

  return (
    <Link asChild href={{ pathname: "/badge/[id]", params: { id: badge.id } }}>
      <Link.Trigger>
        <Pressable
          accessibilityLabel={t("View {{title}} badge", { title })}
          accessibilityRole="button"
          style={StyleSheet.flatten([styles.badgeItem, { width }])}
        >
          <BadgeMedallion
            accessibilityLabel={t("{{title}}, {{state}}", {
              state: locked
                ? t("locked")
                : t("{{tier}} unlocked", { tier: t(tier as TranslationKey) }),
              title,
            })}
            locked={locked}
            size={88}
            symbol={badge.symbol}
            tier={tier}
          />
          <Text
            numberOfLines={2}
            style={[styles.badgeTitle, locked && styles.badgeTitleLocked]}
          >
            {title}
          </Text>
          <Text style={styles.progress}>{progressLabel}</Text>
        </Pressable>
      </Link.Trigger>
    </Link>
  );
}

const styles = StyleSheet.create({
  badgeItem: {
    alignItems: "center",
    paddingBottom: theme.spacing.xl,
  },
  badgeTitle: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  badgeTitleLocked: { color: colors.textMuted },
  collectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 40,
  },
  content: {
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  emptyText: {
    color: colors.textMuted,
    paddingVertical: theme.spacing.xl,
    textAlign: "center",
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  header: { paddingBottom: theme.spacing.lg },
  progress: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
    marginTop: theme.spacing.xs,
  },
  previewButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    height: 50,
    justifyContent: "center",
  },
  previewButtonText: {
    color: colors.background,
    fontSize: theme.size.md,
    fontWeight: "800",
  },
  previewSection: {
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  row: { gap: COLUMN_GAP },
  summaryCopy: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: theme.spacing.md,
    maxWidth: 320,
  },
  summaryCount: {
    color: colors.text,
    fontSize: 48,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  summaryProgressFill: {
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    height: "100%",
  },
  summaryProgressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    height: 6,
    marginTop: theme.spacing.md,
    overflow: "hidden",
  },
  summaryRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  summaryTotal: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
});
