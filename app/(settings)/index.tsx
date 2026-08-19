import {
  MenuView,
  type MenuAction,
  type NativeActionEvent,
} from "@expo/ui/community/menu";
import { useQuery } from "@tanstack/react-query";
import { reloadAppAsync } from "expo";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useLocales } from "expo-localization";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";
import { useRevenueCat } from "@/hooks/use-revenuecat";
import {
  exportLocalDatabaseBackup,
  importLocalDatabaseBackup,
} from "@/lib/database-backup";
import {
  isPlatformPreferenceId,
  platformPreferences,
} from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";
import { currentProfileQueryKey, getCurrentProfile } from "@/services/sharing";
import { PressableOpacity, PressableScale } from "pressto";

type SymbolName = SymbolViewProps["name"];

type SettingsRow = {
  icon: SymbolName;
  id: string;
  label: string;
  menuActions?: MenuAction[];
  onMenuAction?: (event: NativeActionEvent) => void;
  onPress?: () => void;
};

type SettingsSection = {
  data: SettingsRow[];
  title: string;
};

const supportEmail = "support@joylogue.app";
const termsUrl = "https://joylogue.app/terms";
const privacyUrl = "https://joylogue.app/privacy";
const termsLabel = "Terms of Service";
const privacyLabel = "Privacy Policy";

function ProfileHero({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  const { t } = useTranslation();
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";

  return (
    <View style={styles.profileHero}>
      <View style={styles.profileAvatar}>
        {avatarUrl ? (
          <Image
            accessibilityLabel={t("{{name}}'s profile picture", {
              name: displayName,
            })}
            contentFit="cover"
            source={avatarUrl}
            style={StyleSheet.absoluteFill}
            transition={180}
          />
        ) : (
          <Text style={styles.profileInitial}>{initial}</Text>
        )}
      </View>

      <View style={styles.profileCopy}>
        <Text numberOfLines={1} selectable style={styles.profileName}>
          {displayName}
        </Text>
        <Text style={styles.profileDetail}>{t("Anonymous profile")}</Text>
      </View>

      <PressableOpacity
        accessibilityLabel={t("Edit profile")}
        accessibilityRole="button"
        onPress={() => router.push("/(settings)/profile")}
        style={styles.editProfileButton}
      >
        <Text style={styles.editProfileText}>{t("Edit profile")}</Text>
      </PressableOpacity>
    </View>
  );
}

function RowIcon({ name }: { name: SymbolName }) {
  return (
    <View style={styles.rowIcon}>
      <SymbolView
        fallback={<View style={styles.symbolFallback} />}
        name={name}
        size={19}
        tintColor={colors.text}
        weight="semibold"
      />
    </View>
  );
}

function SettingsRowView({
  icon,
  isFirst,
  isLast,
  label,
  menuActions,
  onMenuAction,
  onPress,
}: SettingsRow & { isFirst: boolean; isLast: boolean }) {
  const { t } = useTranslation();
  const content = (
    <>
      <RowIcon name={icon} />
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowLabel}>
          {label}
        </Text>
      </View>
      {onPress || menuActions ? (
        <SymbolView
          fallback={<View style={styles.chevronFallback} />}
          name={{
            android: "chevron_right",
            ios: "chevron.forward",
            web: "chevron_right",
          }}
          size={14}
          tintColor={colors.textMuted}
          weight="semibold"
        />
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.rowShell,
        isFirst && styles.rowShellFirst,
        isLast && styles.rowShellLast,
      ]}
    >
      {onPress ? (
        <PressableOpacity
          accessibilityLabel={label}
          accessibilityRole="button"
          onPress={onPress}
          style={styles.row}
        >
          {content}
        </PressableOpacity>
      ) : menuActions && onMenuAction ? (
        <MenuView
          actions={menuActions}
          onPressAction={onMenuAction}
          style={styles.menuTrigger}
          title={t("Preferred platforms")}
        >
          <View
            accessibilityLabel={label}
            accessibilityRole="button"
            style={styles.row}
          >
            {content}
          </View>
        </MenuView>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
      {!isLast ? <View style={styles.separator} /> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const locales = useLocales();
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const { savePlatforms, state: onboardingState } = useOnboarding();
  const profileQuery = useQuery({
    queryFn: getCurrentProfile,
    queryKey: currentProfileQueryKey,
    staleTime: 5 * 60 * 1000,
  });
  const {
    isConfigured,
    isLoading,
    isPro,
    presentCustomerCenter,
    presentPaywallIfNeeded,
  } = useRevenueCat();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const selectedPlatformIds = onboardingState.selectedPlatformIds;
  const languageCode = locales[0]?.languageCode ?? "en";
  const languageName =
    languageCode === "de"
      ? t("German")
      : languageCode === "fr"
        ? t("French")
        : languageCode === "es"
          ? t("Spanish")
          : t("English");
  const platformActions: MenuAction[] = platformPreferences.map((platform) => ({
    id: platform.id,
    image:
      platform.id === "mobile"
        ? "iphone"
        : platform.id === "pc"
          ? "desktopcomputer"
          : "gamecontroller.fill",
    state: selectedPlatformIds.includes(platform.id) ? "on" : "off",
    title: platform.label,
  }));

  async function togglePlatform(event: NativeActionEvent) {
    const platformId = event.nativeEvent.event;
    if (!isPlatformPreferenceId(platformId)) return;

    const nextPlatformIds = selectedPlatformIds.includes(platformId)
      ? selectedPlatformIds.filter((id) => id !== platformId)
      : [...selectedPlatformIds, platformId];

    try {
      await savePlatforms(nextPlatformIds);
    } catch {
      Alert.alert(
        t("Platforms not updated"),
        t("Joylogue could not save your platform preferences."),
      );
    }
  }

  async function openSubscription() {
    if (!isPro) {
      await presentPaywallIfNeeded();
      return;
    }

    try {
      await presentCustomerCenter();
    } catch {
      Alert.alert(
        t("Subscription unavailable"),
        t(
          "Joylogue could not open subscription management. Try again in a moment.",
        ),
      );
    }
  }

  async function openCustomerCenter() {
    try {
      await presentCustomerCenter();
    } catch {
      Alert.alert(
        t("Customer Center unavailable"),
        t("Joylogue could not open Customer Center. Try again in a moment."),
      );
    }
  }

  async function sendFeedback() {
    const subject = encodeURIComponent("Joylogue feedback");
    const url = `mailto:${supportEmail}?subject=${subject}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t("Email unavailable"),
        t("Contact us at {{email}}.", { email: supportEmail }),
      );
    }
  }

  async function openNotificationSettings() {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        t("Settings unavailable"),
        t("Open your device settings to update Joylogue notifications."),
      );
    }
  }

  async function openLanguageSettings() {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        t("Settings unavailable"),
        t("Open your device settings to change Joylogue’s language."),
      );
    }
  }

  async function openExternalUrl(url: string, fallbackTitle: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Link unavailable",
        `Open ${fallbackTitle} at ${url}.`,
      );
    }
  }

  async function exportBackup() {
    if (isExportingBackup) return;

    if (!(await canUseBackupFeatures())) return;

    setIsExportingBackup(true);
    try {
      await exportLocalDatabaseBackup();
    } catch (error) {
      console.error("Unable to export local backup", error);
      Alert.alert(
        t("Backup not exported"),
        t("Joylogue could not prepare your local backup."),
      );
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function canUseBackupFeatures() {
    if (isPro) return true;

    if (!isConfigured || isLoading) {
      Alert.alert(
        "Joylogue Pro",
        t("The upgrade screen is still loading. Try again in a moment."),
      );
      return false;
    }

    try {
      const result = await presentPaywallIfNeeded();
      if (result === PAYWALL_RESULT.ERROR) {
        Alert.alert(
          t("Purchase unavailable"),
          t("Joylogue could not confirm Pro access. Try again in a moment."),
        );
        return false;
      }

      return (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED ||
        result === PAYWALL_RESULT.NOT_PRESENTED
      );
    } catch {
      Alert.alert(
        t("Purchase unavailable"),
        t("Joylogue could not open the upgrade screen. Try again in a moment."),
      );
      return false;
    }
  }

  async function chooseBackupToImport() {
    if (isImportingBackup || isExportingBackup) return;
    if (!(await canUseBackupFeatures())) return;

    Alert.alert(
      t("Replace local Joylogue data?"),
      t(
        "Importing a backup replaces every local game, status, rating, note, badge, and preference on this device. This cannot be undone unless you export the current data first.",
      ),
      [
        { style: "cancel", text: t("Cancel") },
        {
          onPress: () => void importBackup(),
          style: "destructive",
          text: t("Choose backup"),
        },
      ],
    );
  }

  async function importBackup() {
    setIsImportingBackup(true);
    try {
      const result = await importLocalDatabaseBackup();
      if (result === "cancelled") return;

      Alert.alert(
        t("Backup imported"),
        t("Joylogue will reload to display the restored library."),
        [
          {
            onPress: () =>
              void reloadAppAsync("Reload after importing SQLite backup"),
            text: t("Reload Joylogue"),
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error("Unable to import local backup", error);
      Alert.alert(
        t("Backup not imported"),
        t("Joylogue could not restore this backup."),
      );
    } finally {
      setIsImportingBackup(false);
    }
  }

  const sections: SettingsSection[] = [
    {
      title: t("Your Joylogue"),
      data: [
        {
          id: "badges",
          label: t("Badges"),
          icon: {
            android: "workspace_premium",
            ios: "medal.fill",
            web: "workspace_premium",
          },
          onPress: () => router.push("/(badges)/badges"),
        },
        {
          id: "share",
          label: t("Share your backlog"),
          icon: {
            android: "ios_share",
            ios: "square.and.arrow.up.fill",
            web: "ios_share",
          },
          onPress: () => router.push("/share"),
        },
      ],
    },
    {
      title: t("Preferences"),
      data: [
        {
          id: "platforms",
          label: t("Preferred platforms"),
          icon: {
            android: "sports_esports",
            ios: "gamecontroller.fill",
            web: "sports_esports",
          },
          menuActions: platformActions,
          onMenuAction: (event) => void togglePlatform(event),
        },
        {
          id: "notifications",
          label: t("Notifications"),
          icon: {
            android: "notifications",
            ios: "bell.badge.fill",
            web: "notifications",
          },
          onPress: () => void openNotificationSettings(),
        },
        {
          id: "language",
          label: t("Language · {{language}}", { language: languageName }),
          icon: {
            android: "language",
            ios: "globe",
            web: "language",
          },
          onPress: () => void openLanguageSettings(),
        },
      ],
    },
    {
      title: t("Data"),
      data: [
        {
          id: "export-backup",
          label: isExportingBackup
            ? t("Preparing backup…")
            : t("Export local backup"),
          icon: {
            android: "backup",
            ios: "externaldrive.fill",
            web: "backup",
          },
          onPress: () => void exportBackup(),
        },
        {
          id: "import-backup",
          label: isImportingBackup
            ? t("Checking backup…")
            : t("Import local backup"),
          icon: {
            android: "restore",
            ios: "externaldrive.badge.plus",
            web: "restore",
          },
          onPress: () => void chooseBackupToImport(),
        },
      ],
    },
    {
      title: t("Support"),
      data: [
        {
          id: "feedback",
          label: t("Send feedback"),
          icon: { android: "mail", ios: "envelope.fill", web: "mail" },
          onPress: () => void sendFeedback(),
        },
        ...(isConfigured
          ? [
              {
                id: "customer-center",
                label: t("Customer Center"),
                icon: {
                  android: "account_circle",
                  ios: "person.crop.circle",
                  web: "account_circle",
                } satisfies SymbolName,
                onPress: () => void openCustomerCenter(),
              },
            ]
          : []),
      ],
    },
    {
      title: t("About"),
      data: [
        {
          id: "version",
          label: t("Joylogue {{version}}", { version }),
          icon: {
            android: "sports_esports",
            ios: "gamecontroller.fill",
            web: "sports_esports",
          },
        },
        {
          id: "terms",
          label: termsLabel,
          icon: {
            android: "description",
            ios: "doc.text.fill",
            web: "description",
          },
          onPress: () => void openExternalUrl(termsUrl, termsLabel),
        },
        {
          id: "privacy",
          label: privacyLabel,
          icon: {
            android: "policy",
            ios: "hand.raised.fill",
            web: "policy",
          },
          onPress: () => void openExternalUrl(privacyUrl, privacyLabel),
        },
      ],
    },
  ];

  return (
    <SectionList
      ListHeaderComponent={
        <View>
          <ProfileHero
            avatarUrl={profileQuery.data?.avatarUrl ?? null}
            displayName={profileQuery.data?.displayName ?? t("Player")}
          />

          <PressableScale
            accessibilityLabel={
              isPro ? t("Manage Joylogue Pro") : t("Open Joylogue Pro")
            }
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => void openSubscription()}
            style={styles.proCard}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.10)", "rgba(100,255,218,0.05)"]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.proGradient}
            >
              <View style={styles.proIcon}>
                <SymbolView
                  fallback={<View style={styles.proIconFallback} />}
                  name={{
                    android: "auto_awesome",
                    ios: "sparkles",
                    web: "auto_awesome",
                  }}
                  size={26}
                  tintColor={colors.text}
                  weight="bold"
                />
              </View>

              <View style={styles.proCopy}>
                <View style={styles.proTitleRow}>
                  <Text style={styles.proTitle}>Joylogue Pro</Text>
                  {isPro ? (
                    <Text style={styles.activeLabel}>{t("ACTIVE")}</Text>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.proDescription}>
                  {isPro
                    ? t("Your Pro features are active.")
                    : t("Unlock the complete Joylogue experience.")}
                </Text>
              </View>

              {isLoading ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <View style={styles.proAction}>
                  <Text style={styles.proActionText}>
                    {isPro ? t("Manage") : t("View")}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </PressableScale>
        </View>
      }
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyExtractor={(item) => item.id}
      renderItem={({ index, item, section }) => (
        <SettingsRowView
          {...item}
          isFirst={index === 0}
          isLast={index === section.data.length - 1}
        />
      )}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      sections={sections}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      style={styles.screen}
    />
  );
}

const styles = StyleSheet.create({
  activeLabel: {
    color: colors.success,
    fontSize: theme.size.tiny,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  chevronFallback: {
    height: 14,
    width: 14,
  },
  content: {
    paddingBottom: 48,
    paddingHorizontal: theme.spacing.md,
  },
  editProfileButton: {
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
  },
  editProfileButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  editProfileText: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  proAction: {
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  proActionText: {
    color: colors.background,
    fontSize: theme.size.md,
    fontWeight: "800",
  },
  proCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: theme.spacing.md,
    overflow: "hidden",
  },
  proCardPressed: {
    opacity: 0.78,
  },
  proCopy: {
    flex: 1,
    gap: theme.spacing.xs,
    minWidth: 0,
  },
  proDescription: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "600",
    lineHeight: 19,
  },
  proGradient: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    minHeight: 112,
    padding: theme.spacing.md,
  },
  proIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  proIconFallback: {
    height: 26,
    width: 26,
  },
  proTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "900",
  },
  proTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  profileAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: 52,
    borderWidth: StyleSheet.hairlineWidth,
    height: 104,
    justifyContent: "center",
    overflow: "hidden",
    width: 104,
  },
  profileCopy: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  profileDetail: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  profileHero: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  profileInitial: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "700",
  },
  profileName: {
    color: colors.text,
    fontSize: theme.size["3xl"],
    fontWeight: "800",
    maxWidth: "100%",
    textAlign: "center",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderCurve: "continuous",
    borderRadius: 11,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  rowLabel: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  menuTrigger: {
    width: "100%",
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowShell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  rowShellFirst: {
    borderCurve: "continuous",
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowShellLast: {
    borderBottomLeftRadius: theme.radius.md,
    borderBottomRightRadius: theme.radius.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  screen: {
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    textTransform: "uppercase",
  },
  separator: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  symbolFallback: {
    height: 19,
    width: 19,
  },
});
