import { File } from "expo-file-system";

import { getSupabaseClient } from "@/lib/supabase";
import {
  ensureCloudUser,
  type CurrentProfile,
} from "@/services/sharing";

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type ProfileAvatarUpload = {
  fileName?: string | null;
  mimeType?: string | null;
  uri: string;
};

function getAvatarExtension({
  fileName,
  mimeType,
  uri,
}: ProfileAvatarUpload) {
  const extensionFromMime = {
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[mimeType ?? ""];

  if (extensionFromMime) return extensionFromMime;

  const candidate = (fileName ?? uri.split("?")[0].split("/").at(-1) ?? "")
    .split(".")
    .at(-1)
    ?.toLowerCase();

  if (
    candidate &&
    ["heic", "heif", "jpeg", "jpg", "png", "webp"].includes(candidate)
  ) {
    return candidate === "jpeg" ? "jpg" : candidate;
  }

  return "jpg";
}

function getAvatarContentType(extension: string, mimeType?: string | null) {
  if (mimeType?.startsWith("image/")) return mimeType;

  return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
}

function getOwnedAvatarPath(avatarUrl: string | null, userId: string) {
  if (!avatarUrl) return null;

  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const encodedPath = avatarUrl.split(marker)[1]?.split("?")[0];
  if (!encodedPath) return null;

  const path = decodeURIComponent(encodedPath);
  return path.startsWith(`${userId}/`) ? path : null;
}

export async function uploadCurrentProfileAvatar(
  upload: ProfileAvatarUpload,
): Promise<CurrentProfile> {
  const user = await ensureCloudUser();
  const supabase = getSupabaseClient();
  const file = new File(upload.uri);
  const bytes = await file.arrayBuffer();

  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error("Choose a profile picture smaller than 5 MB.");
  }

  const extension = getAvatarExtension(upload);
  const version = Date.now();
  const path = `${user.id}/avatar-${version}.${extension}`;
  const { data: currentProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  if (profileReadError) throw profileReadError;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, {
      cacheControl: "31536000",
      contentType: getAvatarContentType(extension, upload.mimeType),
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);
  const avatarUrl = `${publicUrlData.publicUrl}?v=${version}`;
  const { data, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)
    .select("id, display_name, avatar_url")
    .single();

  if (updateError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    throw updateError;
  }

  const previousPath = getOwnedAvatarPath(currentProfile.avatar_url, user.id);
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  return {
    avatarUrl: data.avatar_url,
    displayName: data.display_name,
    id: data.id,
  };
}
