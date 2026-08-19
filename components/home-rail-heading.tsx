import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/Themed";
import { colors, theme } from "@/constants/theme";
import type { HomeFeedType } from "@/lib/home-feed";

export function HomeRailHeading({
  feed,
  subtitle,
  title,
}: {
  feed: HomeFeedType;
  subtitle: string;
  title: string;
}) {
  const { t } = useTranslation();
  return (
    <Link
      asChild
      style={styles.container}
      href={{ pathname: "/feed/[type]", params: { type: feed } }}
    >
      <Pressable
        accessibilityLabel={t("See all {{title}}", { title })}
        accessibilityRole="link"
        hitSlop={8}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <SymbolView
          accessible={false}
          name={{
            android: "chevron_right",
            ios: "chevron.right",
            web: "chevron_right",
          }}
          size={20}
          tintColor={colors.textMuted}
          weight="semibold"
        />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
  },

  title: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "600",
  },
});
