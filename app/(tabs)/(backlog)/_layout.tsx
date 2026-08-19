import { colors } from "@/constants/theme";
import { useQuery } from "@tanstack/react-query";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { currentProfileQueryKey, getCurrentProfile } from "@/services/sharing";
import { createHeaderLeftOptions } from "@/lib/header-item-options";
import { createNativeBackItems } from "@/lib/native-header-items";

type ProfileHeaderButtonProps = {
  accessibilityLabel: string;
  avatarAccessibilityLabel: string;
  avatarUrl: string | null;
  displayName: string;
  onPress: () => void;
};

function ProfileHeaderButton({
  accessibilityLabel,
  avatarAccessibilityLabel,
  avatarUrl,
  displayName,
  onPress,
}: ProfileHeaderButtonProps) {
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.profileButton]}
    >
      {avatarUrl ? (
        <Image
          accessibilityLabel={avatarAccessibilityLabel}
          contentFit="cover"
          source={avatarUrl}
          style={styles.profileImage}
          transition={160}
        />
      ) : initial && displayName !== "Player" ? (
        <Text style={styles.profileInitial}>{initial}</Text>
      ) : (
        <SymbolView
          fallback={<View style={styles.symbolFallback} />}
          name={{ android: "person", ios: "person.crop.circle.fill" }}
          size={36}
          tintColor={colors.textMuted}
          weight="regular"
        />
      )}
    </Pressable>
  );
}

export default function BacklogStackLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const nativeBackItems = createNativeBackItems({
    onPress: () => router.back(),
  });
  const profileQuery = useQuery({
    queryFn: getCurrentProfile,
    queryKey: currentProfileQueryKey,
    staleTime: 5 * 60 * 1000,
  });
  const profile = profileQuery.data;

  return (
    <Stack
      screenOptions={{
        headerTransparent: isLiquidGlassAvailable(),
        headerStyle: {
          backgroundColor: isLiquidGlassAvailable()
            ? "transparent"
            : colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("Backlog"),
          ...createHeaderLeftOptions(() => [
            {
              type: "custom",
              element: (
                <ProfileHeaderButton
                  accessibilityLabel={t("Open settings")}
                  avatarAccessibilityLabel={t("{{name}}'s profile picture", {
                    name: profile?.displayName ?? t("Player"),
                  })}
                  avatarUrl={profile?.avatarUrl ?? null}
                  displayName={profile?.displayName ?? t("Player")}
                  onPress={() => router.push("/(settings)")}
                />
              ),
              hidesSharedBackground: true,
            },
          ]),
        }}
      />
      <Stack.Screen
        name="status/[status]"
        options={{ ...createHeaderLeftOptions(nativeBackItems) }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  profileButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    overflow: "hidden",
    width: 36,
  },

  profileImage: {
    height: "100%",
    width: "100%",
  },
  profileInitial: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  symbolFallback: {
    height: 30,
    width: 30,
  },
});
