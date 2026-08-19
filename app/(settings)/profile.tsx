import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { usePostHog } from "posthog-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, theme } from "@/constants/theme";
import {
  uploadCurrentProfileAvatar,
  type ProfileAvatarUpload,
} from "@/services/profile-avatar";
import {
  currentProfileQueryKey,
  getCurrentProfile,
  updateCurrentProfile,
  type CurrentProfile,
} from "@/services/sharing";

function EditProfileForm({ profile }: { profile: CurrentProfile }) {
  const { t } = useTranslation();
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: updateCurrentProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(currentProfileQueryKey, profile);
      posthog.capture("profile_updated");
      router.back();
    },
  });
  const avatarMutation = useMutation({
    mutationFn: (upload: ProfileAvatarUpload) =>
      uploadCurrentProfileAvatar(upload),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(currentProfileQueryKey, updatedProfile);
      posthog.capture("profile_avatar_updated");
    },
    onSettled: () => {
      setPendingAvatarUri(null);
    },
  });
  const normalizedName = displayName.trim();
  const canSave =
    normalizedName.length > 0 &&
    normalizedName.length <= 40 &&
    normalizedName !== profile.displayName &&
    !avatarMutation.isPending &&
    !updateMutation.isPending;
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || "S";
  const avatarUri = pendingAvatarUri ?? profile.avatarUrl;

  async function pickAvatar() {
    if (avatarMutation.isPending) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.82,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setPendingAvatarUri(asset.uri);
    avatarMutation.mutate(
      {
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        uri: asset.uri,
      },
      {
        onError: (error) => {
          console.error("Unable to update profile picture", error);
          Alert.alert(
            t("Profile picture not updated"),
            t("Joylogue could not upload that picture. Try another image."),
          );
        },
      },
    );
  }

  function save() {
    if (!canSave) return;
    updateMutation.mutate(normalizedName, {
      onError: () => {
        Alert.alert(
          t("Profile not updated"),
          t("Joylogue could not save your display name. Try again in a moment."),
        );
      },
    });
  }

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityHint={t("Opens your photo library")}
        accessibilityLabel={t("Change profile picture")}
        accessibilityRole="button"
        disabled={avatarMutation.isPending}
        onPress={pickAvatar}
        style={({ pressed }) => [
          styles.avatarButton,
          pressed && styles.avatarButtonPressed,
        ]}
      >
        <View style={styles.avatar}>
          {avatarUri ? (
            <Image
              accessibilityLabel={t("{{name}}'s profile picture", {
                name: profile.displayName,
              })}
              contentFit="cover"
              source={avatarUri}
              style={StyleSheet.absoluteFill}
              transition={180}
            />
          ) : (
            <Text style={styles.initial}>{initial}</Text>
          )}
          {avatarMutation.isPending ? (
            <View style={styles.avatarLoading}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : null}
        </View>
        <View style={styles.avatarEditBadge}>
          <SymbolView
            fallback={<View style={styles.avatarEditFallback} />}
            name={{
              android: "add_a_photo",
              ios: "photo.badge.plus",
            }}
            size={17}
            tintColor={colors.background}
            weight="semibold"
          />
        </View>
      </Pressable>

      <View style={styles.form}>
        <Text style={styles.label}>{t("Display name")}</Text>
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          editable={!updateMutation.isPending}
          maxLength={40}
          onChangeText={setDisplayName}
          placeholder={t("Player")}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          selectionColor={colors.success}
          style={styles.input}
          value={displayName}
        />
        <Text style={styles.hint}>
          {t("Friends will see this name on invites and shared backlogs.")}
        </Text>
      </View>

      <Pressable
        accessibilityLabel={t("Save profile")}
        accessibilityRole="button"
        disabled={!canSave}
        onPress={save}
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && styles.saveButtonDisabled,
          pressed && canSave && styles.saveButtonPressed,
        ]}
      >
        {updateMutation.isPending ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.saveButtonText}>{t("Save")}</Text>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

export default function EditProfileScreen() {
  const profileQuery = useQuery({
    queryFn: getCurrentProfile,
    queryKey: currentProfileQueryKey,
  });

  if (!profileQuery.data) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <EditProfileForm key={profileQuery.data.id} profile={profileQuery.data} />
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    alignSelf: "center",
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
  avatarButton: {
    alignItems: "center",
    alignSelf: "center",
    height: 116,
    justifyContent: "center",
    width: 116,
  },
  avatarButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  avatarEditBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.background,
    borderRadius: 18,
    borderWidth: 3,
    bottom: 0,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 36,
  },
  avatarEditFallback: {
    height: 17,
    width: 17,
  },
  avatarLoading: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
    paddingBottom: 48,
  },
  form: {
    gap: theme.spacing.sm,
  },
  hint: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontWeight: "500",
    lineHeight: 18,
  },
  initial: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "700",
  },
  input: {
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "600",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    minHeight: 56,
  },
  saveButtonDisabled: {
    opacity: 0.3,
  },
  saveButtonPressed: {
    opacity: 0.78,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: theme.size.lg,
    fontWeight: "900",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
