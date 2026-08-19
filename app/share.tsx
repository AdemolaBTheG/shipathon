import { JoylogueInviteQr } from "@/components/joylogue-invite-qr";
import { colors, theme } from "@/constants/theme";
import { prepareShareInvite } from "@/services/sharing";
import { useQuery } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Clipboard from "expo-clipboard";
import { SymbolView } from "expo-symbols";
import { PressableOpacity, PressableScale } from "pressto";
import { usePostHog } from "posthog-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";

export default function ShareScreen() {
  const { t } = useTranslation();
  const posthog = usePostHog();
  const inviteQuery = useQuery({
    queryFn: prepareShareInvite,
    queryKey: ["share-invite"],
    staleTime: Number.POSITIVE_INFINITY,
  });
  const inviteUrl = inviteQuery.data?.url;

  const shareInvite = async () => {
    if (!inviteUrl) return;

    try {
      await Share.share({
        message: t(
          "Join me on Joylogue and compare our gaming backlogs: {{url}}",
          { url: inviteUrl },
        ),
        title: t("Join me on Joylogue"),
        url: inviteUrl,
      });
      posthog.capture("invite_shared");
    } catch {
      Burnt.toast({
        preset: "error",
        title: t("Could not share invite"),
      });
    }
  };

  const copyInviteLink = async () => {
    if (!inviteUrl) return;

    await Clipboard.setStringAsync(inviteUrl);
    posthog.capture("invite_link_copied");
    Burnt.toast({ title: t("Invite link copied") });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <JoylogueInviteQr
        animateOnResolve={inviteQuery.isFetchedAfterMount}
        failed={inviteQuery.isError}
        loading={inviteQuery.isPending || inviteQuery.isFetching}
        url={inviteUrl}
      />

      {inviteQuery.isError ? (
        <View style={styles.stateCard}>
          <SymbolView
            name={{ android: "warning", ios: "exclamationmark.triangle.fill" }}
            size={34}
            tintColor={colors.primary}
          />
          <Text style={styles.stateTitle}>
            {t("Couldn't create your invite")}
          </Text>
          <Text style={styles.stateText}>
            {t("Check your connection, then try creating the invite again.")}
          </Text>
          <PressableScale
            accessibilityLabel={t("Try creating invite again")}
            accessibilityRole="button"
            onPress={() => inviteQuery.refetch()}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>{t("Try again")}</Text>
          </PressableScale>
        </View>
      ) : null}

      {inviteUrl ? (
        <View style={styles.actions}>
          <PressableScale
            accessibilityHint={t("Opens the system share sheet")}
            accessibilityLabel={t("Share invite")}
            accessibilityRole="button"
            onPress={shareInvite}
            style={styles.primaryButton}
          >
            <SymbolView
              name={{ android: "ios_share", ios: "square.and.arrow.up" }}
              size={24}
              tintColor="#000"
            />
            <Text style={styles.primaryButtonText}>{t("Share invite")}</Text>
          </PressableScale>

          <PressableOpacity
            accessibilityLabel={t("Copy invite link")}
            accessibilityRole="button"
            onPress={copyInviteLink}
            style={styles.secondaryButton}
          >
            <SymbolView
              name={{ android: "link", ios: "link" }}
              size={20}
              tintColor={colors.text}
            />
            <Text style={styles.secondaryButtonText}>{t("Copy link")}</Text>
          </PressableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {},
  content: {
    gap: theme.spacing.lg,
    paddingBottom: 60,
    paddingHorizontal: theme.spacing.md,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: 28,
    borderWidth: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 360,
    padding: theme.spacing.lg,
  },
  stateTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "800",
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  stateText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  retryButtonText: {
    color: colors.background,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonText: {
    color: "#000",
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    paddingVertical: 14,

    paddingHorizontal: theme.spacing.lg,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.78,
  },
});
