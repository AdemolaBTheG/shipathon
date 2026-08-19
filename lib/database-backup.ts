import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import {
  backupDatabaseAsync,
  deserializeDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";

import { expoDb } from "@/db/client";

const maximumBackupBytes = 128 * 1024 * 1024;
const requiredColumns = {
  backlog_items: [
    "id",
    "game_id",
    "status",
    "rating",
    "notes",
    "source_url",
    "progress_current",
    "progress_total",
    "added_at",
    "started_at",
    "completed_at",
  ],
  badge_unlocks: ["key", "badge_id", "tier", "unlocked_at", "seen_at"],
  games: [
    "igdb_id",
    "name",
    "slug",
    "summary",
    "release_date",
    "cover_url",
    "platforms_json",
    "genres_json",
    "game_modes_json",
    "updated_at",
  ],
  link_resolutions: [
    "source_url",
    "resolution_json",
    "schema_version",
    "expires_at",
    "updated_at",
  ],
  onboarding_state: [
    "id",
    "current_step",
    "selected_platform_ids_json",
    "selected_game_id",
    "selected_game_name",
    "selected_game_cover_url",
    "notification_preference",
    "onboarding_completed_at",
    "updated_at",
  ],
} as const;

function backupFilename(date: Date) {
  const timestamp = date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replaceAll(":", "-");

  return `Joylogue-backup-${timestamp}.sqlite3`;
}

async function validateJoylogueDatabase(database: SQLiteDatabase) {
  const integrity = await database.getFirstAsync<{ integrity_check: string }>(
    "PRAGMA integrity_check",
  );

  if (integrity?.integrity_check !== "ok") {
    throw new Error("This backup is damaged and could not be imported.");
  }

  const foreignKeyErrors = await database.getAllAsync(
    "PRAGMA foreign_key_check",
  );
  if (foreignKeyErrors.length > 0) {
    throw new Error("This backup contains invalid game relationships.");
  }

  for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
    const columns = await database.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${table})`,
    );
    const columnNames = new Set(columns.map((column) => column.name));

    if (
      columns.length === 0 ||
      expectedColumns.some((column) => !columnNames.has(column))
    ) {
      throw new Error(
        "This file is not a compatible Joylogue backup. Update Joylogue on the original device and export it again.",
      );
    }
  }
}

export async function exportLocalDatabaseBackup() {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is unavailable on this device.");
  }

  const backup = new File(Paths.cache, backupFilename(new Date()));

  try {
    const serializedDatabase = await expoDb.serializeAsync();
    backup.create({ intermediates: true, overwrite: true });
    backup.write(serializedDatabase);

    await Sharing.shareAsync(backup.uri, {
      dialogTitle: "Export Joylogue backup",
      mimeType: "application/vnd.sqlite3",
      UTI: "public.database",
    });
  } finally {
    if (backup.exists) backup.delete();
  }
}

export async function importLocalDatabaseBackup() {
  const selection = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: "*/*",
  });

  if (selection.canceled) return "cancelled" as const;

  const asset = selection.assets[0];
  if (!asset) throw new Error("No backup file was selected.");
  if (asset.size && asset.size > maximumBackupBytes) {
    throw new Error("This backup is too large to import safely.");
  }

  const selectedFile = new File(asset.uri);
  const serializedDatabase = await selectedFile.bytes();
  if (serializedDatabase.byteLength > maximumBackupBytes) {
    throw new Error("This backup is too large to import safely.");
  }

  let importedDatabase: SQLiteDatabase | null = null;
  let recoveryDatabase: SQLiteDatabase | null = null;

  try {
    importedDatabase = await deserializeDatabaseAsync(serializedDatabase);
    await validateJoylogueDatabase(importedDatabase);

    recoveryDatabase = await deserializeDatabaseAsync(
      await expoDb.serializeAsync(),
    );

    try {
      await backupDatabaseAsync({
        destDatabase: expoDb,
        sourceDatabase: importedDatabase,
      });
      await validateJoylogueDatabase(expoDb);
    } catch (error) {
      await backupDatabaseAsync({
        destDatabase: expoDb,
        sourceDatabase: recoveryDatabase,
      });
      throw error;
    }

    return "imported" as const;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("This backup")) {
      throw error;
    }

    throw new Error("The selected file is not a valid Joylogue backup.");
  } finally {
    await importedDatabase?.closeAsync();
    await recoveryDatabase?.closeAsync();
  }
}
