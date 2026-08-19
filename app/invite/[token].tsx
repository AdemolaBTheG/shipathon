import { InviteHero } from "@/components/invite-hero";
import { colors, theme } from "@/constants/theme";
import {
  getInvitePreview,
  sendFriendRequest,
  type InviteRelationshipStatus,
} from "@/services/sharing";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Burnt from "burnt";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { SymbolView } from "expo-symbols";
import { PressableScale } from "pressto";
import { usePostHog } from "posthog-react-native";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TranslationKey } from "@/localization/resources";
import { createHeaderLeftOptions } from "@/lib/header-item-options";

const actionContent: Record<
  InviteRelationshipStatus,
  {
    icon: "checkmark" | "person.badge.plus" | "paperplane.fill" | "ticket.fill";
    label: TranslationKey;
  }
> = {
  available: { icon: "person.badge.plus", label: "Send friend request" },
  friends: { icon: "checkmark", label: "Already friends" },
  "request-sent": { icon: "paperplane.fill", label: "Request sent" },
  self: { icon: "ticket.fill", label: "This is your invite" },
};

type AppRouter = ReturnType<typeof useRouter>;

function dismissInvite(router: AppRouter) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)/(shared)");
  }
}

export default function InviteScreen() {
  const { t } = useTranslation();
  const posthog = usePostHog();
  const { token: tokenParam } = useLocalSearchParams<{
    token?: string | string[];
  }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const previewQuery = useQuery({
    enabled: Boolean(token),
    queryFn: () => getInvitePreview(token!),
    queryKey: ["invite-preview", token],
    retry: false,
  });
  const requestMutation = useMutation({
    mutationFn: () => sendFriendRequest(token!),
    onError: (error) => {
      console.error("Unable to send friend request", error);
      Burnt.toast({
        preset: "error",
        title: t("Unable to send friend request"),
      });
    },
    onSuccess: () => {
      posthog.capture("friend_request_sent");
      Burnt.toast({ title: t("Friend request sent") });
    },
  });
  const preview = previewQuery.data;
  const relationshipStatus = requestMutation.isSuccess
    ? "request-sent"
    : (preview?.relationshipStatus ?? "available");
  const action = actionContent[relationshipStatus];
  const actionLabel = t(action.label);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "",
      ...createHeaderLeftOptions(() => [
        {
          type: "button",
          label: t("Close"),
          icon: { type: "sfSymbol", name: "xmark" },
          accessibilityLabel: t("Close invitation"),
          onPress: () => dismissInvite(router),
        },
      ]),
    });
  }, [navigation, router, t]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "" }} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          preview ? { paddingBottom: 148 + insets.bottom } : null,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scrollView}
      >
        {previewQuery.isPending ? (
          <View style={styles.loadingState}>
            <View style={styles.loadingAvatar}>
              <ActivityIndicator color={colors.text} size="large" />
            </View>
            <Text style={styles.loadingTitle}>{t("Opening invitation")}</Text>
            <Text style={styles.mutedText}>
              {t("Checking this Joylogue invite...")}
            </Text>
          </View>
        ) : null}

        {previewQuery.isError || !token ? (
          <View style={styles.pageBody}>
            <InviteHero
              avatarUrl={null}
              coverUrls={[]}
              displayName={t("Invite unavailable")}
              showVisibleGames={false}
              subtitle={t("This invitation link is incomplete.")}
              visibleGameCount={0}
            />
            <PressableScale
              accessibilityLabel={t("Close invitation")}
              accessibilityRole="button"
              onPress={() => dismissInvite(router)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t("Close")}</Text>
            </PressableScale>
          </View>
        ) : null}

        {preview ? (
          <View style={styles.pageBody}>
            <InviteHero
              avatarUrl={preview.avatarUrl}
              coverUrls={preview.visibleCoverUrls}
              displayName={preview.displayName}
              visibleGameCount={preview.sharedGameCount}
            />
          </View>
        ) : null}
      </ScrollView>

      {preview ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
          ]}
        >
          <View pointerEvents="none" style={styles.footerFade} />
          <View style={styles.actions}>
            <PressableScale
              accessibilityLabel={actionLabel}
              accessibilityRole="button"
              disabled={
                relationshipStatus !== "available" || requestMutation.isPending
              }
              onPress={() => requestMutation.mutate()}
              style={[
                styles.primaryButton,
                relationshipStatus !== "available" &&
                  styles.primaryButtonSettled,
              ]}
            >
              {requestMutation.isPending ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <SymbolView
                  name={action.icon}
                  size={21}
                  tintColor={
                    relationshipStatus === "available"
                      ? colors.background
                      : colors.text
                  }
                />
              )}
              <Text
                style={[
                  styles.primaryButtonText,
                  relationshipStatus !== "available" &&
                    styles.primaryButtonTextSettled,
                ]}
              >
                {requestMutation.isPending ? t("Sending...") : actionLabel}
              </Text>
            </PressableScale>

            <PressableScale
              accessibilityLabel={t("Not now")}
              accessibilityRole="button"
              onPress={() => dismissInvite(router)}
              style={styles.notNowButton}
            >
              <Text style={styles.notNowText}>{t("Not now")}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    experimental_backgroundImage:
      "linear-gradient(180deg, #536666 0%, #354545 24%, #202A2A 46%, #121212 76%)",
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  pageBody: {
    flex: 1,
    gap: theme.spacing.xl,
    justifyContent: "flex-start",
  },
  loadingState: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
  },
  loadingAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 76,
    borderWidth: 1,
    height: 152,
    justifyContent: "center",
    width: 152,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: theme.size["2xl"],
    fontWeight: "800",
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
  actions: {
    gap: 0,
  },
  footer: {
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    position: "absolute",
    right: 0,
  },
  footerFade: {
    experimental_backgroundImage:
      "linear-gradient(180deg, rgba(18,18,18,0) 0%, rgba(18,18,18,0.72) 58%, #121212 100%)",
    height: 56,
    left: 0,
    position: "absolute",
    right: 0,
    top: -56,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonSettled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButtonTextSettled: {
    color: colors.text,
  },
  notNowButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  notNowText: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 54,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
});
