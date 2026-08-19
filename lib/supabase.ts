import "react-native-url-polyfill/auto";

import {
  createClient,
  processLock,
  type SupabaseClient,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import SQLiteStorage from "expo-sqlite/kv-store";
import { AppState, type NativeEventSubscription } from "react-native";

const STORAGE_CHUNK_SIZE = 1800;
// This persisted namespace predates the Joylogue rename and must remain stable.
const SQLITE_FALLBACK_PREFIX = "savepoint.supabase.auth.";

let secureStoreUnavailable = false;

function isMissingKeychainEntitlement(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("required entitlement isn't present") ||
    message.includes("-34018") ||
    message.includes("errSecMissingEntitlement")
  );
}

async function getStoredValue(key: string) {
  if (!secureStoreUnavailable) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) return value;
    } catch (error) {
      if (!isMissingKeychainEntitlement(error)) throw error;
      secureStoreUnavailable = true;
    }
  }

  return SQLiteStorage.getItem(`${SQLITE_FALLBACK_PREFIX}${key}`);
}

async function setStoredValue(key: string, value: string) {
  if (!secureStoreUnavailable) {
    try {
      await SecureStore.setItemAsync(key, value);
      await SQLiteStorage.removeItem(`${SQLITE_FALLBACK_PREFIX}${key}`);
      return;
    } catch (error) {
      if (!isMissingKeychainEntitlement(error)) throw error;
      secureStoreUnavailable = true;
    }
  }

  await SQLiteStorage.setItem(`${SQLITE_FALLBACK_PREFIX}${key}`, value);
}

async function deleteStoredValue(key: string) {
  if (!secureStoreUnavailable) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (!isMissingKeychainEntitlement(error)) throw error;
      secureStoreUnavailable = true;
    }
  }

  await SQLiteStorage.removeItem(`${SQLITE_FALLBACK_PREFIX}${key}`);
}

type StorageManifest = {
  chunks: number;
  version: string;
};

class ChunkedSecureStore {
  private manifestKey(key: string) {
    return `${key}.manifest`;
  }

  private chunkKey(key: string, version: string, index: number) {
    return `${key}.${version}.${index}`;
  }

  private async getManifest(key: string) {
    const value = await getStoredValue(this.manifestKey(key));

    if (!value) return null;

    try {
      return JSON.parse(value) as StorageManifest;
    } catch {
      await deleteStoredValue(this.manifestKey(key));
      return null;
    }
  }

  async getItem(key: string) {
    const manifest = await this.getManifest(key);

    if (!manifest) return null;

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) =>
        getStoredValue(this.chunkKey(key, manifest.version, index)),
      ),
    );

    return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
  }

  async setItem(key: string, value: string) {
    const previousManifest = await this.getManifest(key);
    const version = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const chunks = Array.from(
      { length: Math.max(1, Math.ceil(value.length / STORAGE_CHUNK_SIZE)) },
      (_, index) =>
        value.slice(
          index * STORAGE_CHUNK_SIZE,
          (index + 1) * STORAGE_CHUNK_SIZE,
        ),
    );

    await Promise.all(
      chunks.map((chunk, index) =>
        setStoredValue(this.chunkKey(key, version, index), chunk),
      ),
    );
    await setStoredValue(
      this.manifestKey(key),
      JSON.stringify({ chunks: chunks.length, version } satisfies StorageManifest),
    );

    if (previousManifest) {
      await this.removeChunks(key, previousManifest);
    }
  }

  async removeItem(key: string) {
    const manifest = await this.getManifest(key);

    await deleteStoredValue(this.manifestKey(key));

    if (manifest) {
      await this.removeChunks(key, manifest);
    }
  }

  private async removeChunks(key: string, manifest: StorageManifest) {
    await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) =>
        deleteStoredValue(this.chunkKey(key, manifest.version, index)),
      ),
    );
  }
}

let client: SupabaseClient | null = null;
let appStateSubscription: NativeEventSubscription | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.",
    );
  }

  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
      persistSession: true,
      storage: new ChunkedSecureStore(),
    },
  });

  if (!appStateSubscription) {
    if (AppState.currentState === "active") {
      client.auth.startAutoRefresh();
    }

    appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        client?.auth.startAutoRefresh();
      } else {
        client?.auth.stopAutoRefresh();
      }
    });
  }

  return client;
}
