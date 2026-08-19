import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export type BacklogStatus =
  | "want-to-play"
  | "playing"
  | "completed"
  | "shelved"
  | "abandoned";

export type BadgeTier = "standard" | "bronze" | "silver" | "gold";

export type OnboardingStep =
  | "welcome"
  | "platforms"
  | "games"
  | "rating"
  | "notifications"
  | "paywall"
  | "completed";

export type NotificationPreference =
  | "unknown"
  | "enabled"
  | "skipped"
  | "denied";

export const games = sqliteTable("games", {
  igdbId: integer("igdb_id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  summary: text("summary"),
  releaseDate: text("release_date"),
  coverUrl: text("cover_url"),
  platformsJson: text("platforms_json").notNull().default("[]"),
  genresJson: text("genres_json").notNull().default("[]"),
  gameModesJson: text("game_modes_json").notNull().default("[]"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const backlogItems = sqliteTable(
  "backlog_items",
  {
    id: text("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.igdbId, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["want-to-play", "playing", "completed", "shelved", "abandoned"],
    })
      .notNull()
      .default("want-to-play"),
    rating: real("rating"),
    notes: text("notes"),
    sourceUrl: text("source_url"),
    progressCurrent: integer("progress_current").notNull().default(0),
    progressTotal: integer("progress_total").notNull().default(100),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    gameIdIndex: uniqueIndex("backlog_items_game_id_unique").on(table.gameId),
  }),
);

export const linkResolutions = sqliteTable("link_resolutions", {
  sourceUrl: text("source_url").primaryKey(),
  resolutionJson: text("resolution_json").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const featureUsage = sqliteTable("feature_usage", {
  feature: text("feature").primaryKey(),
  period: text("period").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const badgeUnlocks = sqliteTable(
  "badge_unlocks",
  {
    key: text("key").primaryKey(),
    badgeId: text("badge_id").notNull(),
    tier: text("tier", {
      enum: ["standard", "bronze", "silver", "gold"],
    }).notNull(),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" }).notNull(),
    seenAt: integer("seen_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    badgeTierIndex: uniqueIndex("badge_unlocks_badge_tier_unique").on(
      table.badgeId,
      table.tier,
    ),
  }),
);

export const onboardingState = sqliteTable("onboarding_state", {
  id: text("id").primaryKey(),
  currentStep: text("current_step", {
    enum: [
      "welcome",
      "platforms",
      "games",
      "rating",
      "notifications",
      "paywall",
      "completed",
    ],
  })
    .notNull()
    .default("welcome"),
  selectedPlatformIdsJson: text("selected_platform_ids_json")
    .notNull()
    .default("[]"),
  selectedGameId: integer("selected_game_id"),
  selectedGameName: text("selected_game_name"),
  selectedGameCoverUrl: text("selected_game_cover_url"),
  notificationPreference: text("notification_preference", {
    enum: ["unknown", "enabled", "skipped", "denied"],
  })
    .notNull()
    .default("unknown"),
  onboardingCompletedAt: integer("onboarding_completed_at", {
    mode: "timestamp_ms",
  }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const widgetState = sqliteTable("widget_state", {
  id: text("id").primaryKey(),
  tonightPickGameId: integer("tonight_pick_game_id"),
  isPro: integer("is_pro", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type GameRecord = typeof games.$inferSelect;
export type NewGameRecord = typeof games.$inferInsert;
export type BacklogItemRecord = typeof backlogItems.$inferSelect;
export type NewBacklogItemRecord = typeof backlogItems.$inferInsert;
export type LinkResolutionRecord = typeof linkResolutions.$inferSelect;
export type FeatureUsageRecord = typeof featureUsage.$inferSelect;
export type BadgeUnlockRecord = typeof badgeUnlocks.$inferSelect;
export type OnboardingStateRecord = typeof onboardingState.$inferSelect;
export type WidgetStateRecord = typeof widgetState.$inferSelect;
