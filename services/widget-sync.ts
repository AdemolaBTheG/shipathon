import { desc, eq } from "drizzle-orm";
import { File } from "expo-file-system";
import { widgetsDirectory } from "expo-widgets";
import { Platform } from "react-native";

import { db } from "@/db/client";
import { getOnboardingState } from "@/db/onboarding";
import { backlogItems, games } from "@/db/schema";
import {
  getWidgetState,
  setTonightPickGameId,
  updateWidgetState,
} from "@/db/widget-state";
import { rankGamesByPlatformPreferences } from "@/lib/platform-preferences";
import { i18n } from "@/localization/i18n";
import {
  PlayingNowWidget,
  type PlayingNowWidgetProps,
} from "@/widgets/playing-now-widget";
import { QuickSaveWidget } from "@/widgets/quick-save-widget";
import {
  TonightsPickWidget,
  type TonightWidgetGame,
} from "@/widgets/tonights-pick-widget";

type WidgetBacklogGame = {
  addedAt: Date;
  coverUrl: string | null;
  gameId: number;
  name: string;
  platforms: string[];
  progressCurrent: number;
  progressTotal: number;
  startedAt: Date | null;
  status: typeof backlogItems.$inferSelect.status;
};

let syncQueue = Promise.resolve();

function isWidgetSyncSupported() {
  return Platform.OS === "ios" && widgetsDirectory.length > 0;
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

async function getWidgetBacklog() {
  const rows = await db
    .select({ backlog: backlogItems, game: games })
    .from(backlogItems)
    .innerJoin(games, eq(backlogItems.gameId, games.igdbId))
    .orderBy(desc(backlogItems.addedAt));

  return rows.map<WidgetBacklogGame>(({ backlog, game }) => ({
    addedAt: backlog.addedAt,
    coverUrl: game.coverUrl,
    gameId: game.igdbId,
    name: game.name,
    platforms: parseStringArray(game.platformsJson),
    progressCurrent: backlog.progressCurrent,
    progressTotal: backlog.progressTotal,
    startedAt: backlog.startedAt,
    status: backlog.status,
  }));
}

async function cacheWidgetCover(gameId: number, coverUrl: string | null) {
  if (!coverUrl || !/^https?:\/\//i.test(coverUrl) || !isWidgetSyncSupported()) {
    return null;
  }

  const destination = new File(
    widgetsDirectory,
    `joylogue-widget-cover-${gameId}.jpg`,
  );

  try {
    if (!destination.exists) {
      await File.downloadFileAsync(coverUrl, destination, { idempotent: true });
    }
    return destination.uri;
  } catch (error) {
    if (__DEV__) {
      console.warn(`Unable to cache widget cover for game ${gameId}.`, error);
    }
    return null;
  }
}

function getPlayingGame(backlog: WidgetBacklogGame[]) {
  return backlog
    .filter((game) => game.status === "playing")
    .sort(
      (left, right) =>
        (right.startedAt?.getTime() ?? right.addedAt.getTime()) -
        (left.startedAt?.getTime() ?? left.addedAt.getTime()),
    )[0];
}

async function buildPlayingNowSnapshot(
  backlog: WidgetBacklogGame[],
): Promise<PlayingNowWidgetProps> {
  const game = getPlayingGame(backlog);
  const copy: NonNullable<PlayingNowWidgetProps["copy"]> = {
    chooseNext: i18n.t("Choose what to play next"),
    emptyAccessibility: i18n.t(
      "No game currently playing. Open Joylogue to choose one.",
    ),
    emptyBody: i18n.t("Pick a game and start playing."),
    emptyTitle: i18n.t("Nothing in progress"),
    noGame: i18n.t("No game currently playing"),
    playingNow: i18n.t("Playing Now"),
    progressAccessibilitySuffix: i18n.t(
      "percent complete. Update progress.",
    ),
    startGame: i18n.t("Start a game in Joylogue"),
    updateProgress: i18n.t("Tap to update progress"),
  };

  if (!game) {
    return {
      copy,
      coverUri: null,
      gameId: null,
      progressCurrent: 0,
      progressTotal: 100,
      title: null,
    };
  }

  return {
    copy,
    coverUri: await cacheWidgetCover(game.gameId, game.coverUrl),
    gameId: game.gameId,
    progressCurrent: game.progressCurrent,
    progressTotal: game.progressTotal,
    title: game.name,
  };
}

async function buildTonightSnapshot(
  backlog: WidgetBacklogGame[],
  selectedPlatformIds: string[],
  persistedGameId: number | null,
) {
  const candidates = rankGamesByPlatformPreferences(
    backlog.filter((game) => game.status === "want-to-play"),
    selectedPlatformIds,
  ).slice(0, 5);
  const gamesWithCovers = await Promise.all(
    candidates.map(async (game): Promise<TonightWidgetGame> => ({
      coverUri: await cacheWidgetCover(game.gameId, game.coverUrl),
      gameId: game.gameId,
      platform: game.platforms[0] ?? null,
      title: game.name,
    })),
  );
  const persistedIndex = gamesWithCovers.findIndex(
    (game) => game.gameId === persistedGameId,
  );
  const activeIndex = persistedIndex >= 0 ? persistedIndex : 0;
  const activeGameId = gamesWithCovers[activeIndex]?.gameId ?? null;

  if (activeGameId !== persistedGameId) {
    await setTonightPickGameId(activeGameId);
  }

  return { activeIndex, games: gamesWithCovers };
}

async function syncWidgets(options?: { isPro?: boolean }) {
  if (options?.isPro !== undefined) {
    await updateWidgetState({ isPro: options.isPro });
  }

  if (!isWidgetSyncSupported()) return;

  const [backlog, onboarding, persistedState] = await Promise.all([
    getWidgetBacklog(),
    getOnboardingState(),
    getWidgetState(),
  ]);
  const [playingNow, tonight] = await Promise.all([
    buildPlayingNowSnapshot(backlog),
    buildTonightSnapshot(
      backlog,
      onboarding.selectedPlatformIds,
      persistedState.tonightPickGameId,
    ),
  ]);

  QuickSaveWidget.updateSnapshot({
    copy: {
      foundNextGame: i18n.t("Found your next game?"),
      pasteGameLink: i18n.t("Paste a game link"),
      pasteLink: i18n.t("Paste the link"),
      quickSave: i18n.t("Quick Save"),
      quickSaveAccessibility: i18n.t("Quick Save a game link"),
      quickSaveGame: i18n.t("Quick Save a game"),
      saveBeforeGone: i18n.t("Save it before it disappears."),
      sourceInstructions: i18n.t(
        "Copy a TikTok, YouTube, store, or web link, then tap here.",
      ),
    },
    ready: true,
  });
  PlayingNowWidget.updateSnapshot(playingNow);
  TonightsPickWidget.updateSnapshot({
    ...tonight,
    copy: {
      addToWantToPlay: i18n.t("Add something to Want to Play."),
      emptyAccessibility: i18n.t(
        "Tonight's Pick is empty. Add a game to your backlog.",
      ),
      fromBacklog: i18n.t("From your backlog"),
      lockedAccessibilitySuffix: i18n.t(
        "Joylogue Pro is required to shuffle.",
      ),
      openGame: i18n.t("Open game"),
      proAccessibilitySuffix: i18n.t("Open details or shuffle."),
      shuffle: i18n.t("Shuffle"),
      tonightPick: i18n.t("Tonight's Pick"),
      unlockShuffle: i18n.t("Unlock shuffle with Pro"),
    },
    isPro: options?.isPro ?? persistedState.isPro,
  });
}

export function requestWidgetSync(options?: { isPro?: boolean }) {
  const operation = syncQueue.then(() => syncWidgets(options));
  syncQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export async function adoptTonightPickFromWidget() {
  if (!isWidgetSyncSupported()) return null;

  const timeline = await TonightsPickWidget.getTimeline();
  const latest = [...timeline].sort(
    (left, right) => right.date.getTime() - left.date.getTime(),
  )[0];
  const timelineGames = latest?.props.games;

  if (!Array.isArray(timelineGames) || timelineGames.length === 0) {
    return null;
  }

  const rawIndex = Number(latest.props.activeIndex ?? 0);
  const activeIndex = Number.isFinite(rawIndex)
    ? ((Math.round(rawIndex) % timelineGames.length) + timelineGames.length) %
      timelineGames.length
    : 0;
  const activeGameId = timelineGames[activeIndex]?.gameId;

  if (!Number.isInteger(activeGameId)) return null;

  await setTonightPickGameId(activeGameId);
  return activeGameId;
}
