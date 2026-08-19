import type {
  GamePlaytime,
  GameRecommendation,
  GameSearchResult,
} from "@/lib/igdb";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API_URL = "https://api.igdb.com/v4";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
};

type IgdbGame = {
  artworks?: { height?: number; url?: string; width?: number }[];
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  cover?: { url?: string };
  platforms?: { id: number; name: string }[];
  genres?: { id: number; name: string }[];
  game_modes?: { id: number; name: string }[];
  similar_games?: IgdbGame[];
  screenshots?: { id: number; url?: string }[];
  videos?: { id: number; name?: string; video_id?: string }[];
  involved_companies?: {
    company?: { name?: string };
    developer?: boolean;
    publisher?: boolean;
  }[];
  websites?: {
    type?: { type?: string };
    url?: string;
  }[];
};

type IgdbGameTimeToBeat = {
  completely?: number;
  count?: number;
  game_id: number;
  hastily?: number;
  normally?: number;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

export class IgdbRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "IgdbRequestError";
  }
}

function requiredEnv(name: "TWITCH_CLIENT_ID" | "TWITCH_CLIENT_SECRET") {
  const value =
    name === "TWITCH_CLIENT_ID"
      ? process.env.TWITCH_CLIENT_ID
      : process.env.TWITCH_CLIENT_SECRET;
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  serviceName: string,
) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (
        attempt < MAX_ATTEMPTS - 1 &&
        RETRYABLE_STATUSES.has(response.status)
      ) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1_000, 2_000)
            : 300 * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      return response;
    } catch {
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(300 * 2 ** attempt);
        continue;
      }

      throw new IgdbRequestError(
        controller.signal.aborted
          ? `${serviceName} request timed out`
          : `${serviceName} request failed`,
        controller.signal.aborted ? 504 : 502,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new IgdbRequestError(`${serviceName} request failed`, 502);
}

async function getTwitchAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const response = await fetchWithRetry(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("TWITCH_CLIENT_ID"),
      client_secret: requiredEnv("TWITCH_CLIENT_SECRET"),
      grant_type: "client_credentials",
    }),
  }, "Twitch");

  if (!response.ok) {
    throw new IgdbRequestError("Twitch token request failed", response.status);
  }

  const token = (await response.json()) as TwitchTokenResponse;
  cachedToken = {
    value: token.access_token,
    // Refresh early so an in-flight IGDB request cannot use an expired token.
    expiresAt: now + Math.max(token.expires_in - 300, 60) * 1000,
  };

  return token.access_token;
}

async function requestIgdb<T>(endpoint: string, query: string) {
  const accessToken = await getTwitchAccessToken();
  const response = await fetchWithRetry(`${IGDB_API_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": requiredEnv("TWITCH_CLIENT_ID"),
      Authorization: `Bearer ${accessToken}`,
    },
    body: query,
  }, "IGDB");

  if (!response.ok) {
    throw new IgdbRequestError("IGDB request failed", response.status);
  }

  return (await response.json()) as T[];
}

function requestGames(query: string) {
  return requestIgdb<IgdbGame>("games", query);
}

function escapeSearchTerm(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function toImageUrl(url: string | undefined, size: string) {
  if (!url) return null;
  const normalized = url.startsWith("//") ? `https:${url}` : url;
  return normalized.replace("t_thumb", size);
}

function uniqueCompanyNames(
  companies: IgdbGame["involved_companies"],
  role: "developer" | "publisher",
) {
  return Array.from(
    new Set(
      companies
        ?.filter((company) => company[role] && company.company?.name)
        .map((company) => company.company?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  );
}

function normalizeWebsites(websites: IgdbGame["websites"]) {
  const seenUrls = new Set<string>();

  return (
    websites?.flatMap((website) => {
      if (!website.url) return [];

      try {
        const url = new URL(website.url);
        if (url.protocol !== "https:" && url.protocol !== "http:") return [];
        if (seenUrls.has(url.href)) return [];

        seenUrls.add(url.href);
        return [
          {
            type: website.type?.type?.toLowerCase() ?? "website",
            url: url.href,
          },
        ];
      } catch {
        return [];
      }
    }) ?? []
  );
}

function normalizeGame(game: IgdbGame): GameSearchResult {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug ?? null,
    summary: game.summary ?? null,
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    coverUrl: toImageUrl(game.cover?.url, "t_cover_big"),
    platforms: game.platforms?.map((platform) => platform.name) ?? [],
    genres: game.genres?.map((genre) => genre.name) ?? [],
    gameModes: game.game_modes?.map((mode) => mode.name) ?? [],
    screenshots:
      game.screenshots
        ?.map((screenshot) =>
          toImageUrl(screenshot.url, "t_screenshot_big"),
        )
        .filter((url): url is string => Boolean(url)) ?? [],
    trailerUrl: game.videos?.[0]?.video_id
      ? `https://www.youtube.com/watch?v=${game.videos[0].video_id}`
      : null,
    trailerVideoId: game.videos?.[0]?.video_id ?? null,
    developers: uniqueCompanyNames(game.involved_companies, "developer"),
    publishers: uniqueCompanyNames(game.involved_companies, "publisher"),
    websites: normalizeWebsites(game.websites),
  };
}

function normalizeRecommendation(game: IgdbGame): GameRecommendation {
  const landscapeArtwork = game.artworks
    ?.filter(
      (artwork) =>
        artwork.url &&
        artwork.width &&
        artwork.height &&
        artwork.width > artwork.height,
    )
    .sort(
      (left, right) =>
        (right.width ?? 0) * (right.height ?? 0) -
        (left.width ?? 0) * (left.height ?? 0),
    )[0];
  const artworkUrl = landscapeArtwork?.url
    ? toImageUrl(landscapeArtwork.url, "t_720p")
    : toImageUrl(game.screenshots?.[0]?.url, "t_screenshot_big");

  return { ...normalizeGame(game), artworkUrl };
}

export async function searchIgdbGames(query: string, limit = 8, offset = 0) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
  const safeOffset = Math.min(Math.max(Math.floor(offset), 0), 5_000);
  const games = await requestGames(
    [
      `search "${escapeSearchTerm(query)}";`,
      "fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,game_modes.name;",
      "where version_parent = null;",
      `limit ${safeLimit};`,
      `offset ${safeOffset};`,
    ].join(" "),
  );

  return games.map(normalizeGame);
}

export async function getIgdbGamesByGenre(
  genreId: number,
  limit = 8,
  offset = 0,
  query = "",
) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
  const safeOffset = Math.min(Math.max(Math.floor(offset), 0), 5_000);
  const games = await requestGames(
    [
      ...(query.trim()
        ? [`search "${escapeSearchTerm(query.trim())}";`]
        : []),
      "fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,game_modes.name;",
      `where genres = (${genreId}) & version_parent = null & cover != null & total_rating_count > 0;`,
      ...(query.trim() ? [] : ["sort total_rating_count desc;"]),
      `limit ${safeLimit};`,
      `offset ${safeOffset};`,
    ].join(" "),
  );

  return games.map(normalizeGame);
}

export async function getIgdbGamesByPlatform(
  platformIds: readonly number[],
  limit = 8,
  offset = 0,
  query = "",
) {
  const safePlatformIds = [...new Set(platformIds)]
    .filter((platformId) => Number.isInteger(platformId) && platformId > 0)
    .slice(0, 30);
  if (safePlatformIds.length === 0) return [];

  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
  const safeOffset = Math.min(Math.max(Math.floor(offset), 0), 5_000);
  const games = await requestGames(
    [
      ...(query.trim()
        ? [`search "${escapeSearchTerm(query.trim())}";`]
        : []),
      "fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,game_modes.name;",
      `where platforms = (${safePlatformIds.join(",")}) & version_parent = null & cover != null & total_rating_count > 0;`,
      ...(query.trim() ? [] : ["sort total_rating_count desc;"]),
      `limit ${safeLimit};`,
      `offset ${safeOffset};`,
    ].join(" "),
  );

  return games.map(normalizeGame);
}

export async function getUpcomingIgdbGames(limit = 12, days = 365) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
  const safeDays = Math.min(Math.max(Math.floor(days), 30), 365);
  const now = Math.floor(Date.now() / 1_000);
  const releaseWindowEnd = now + safeDays * 24 * 60 * 60;
  const games = await requestGames(
    [
      "fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,game_modes.name;",
      `where first_release_date > ${now} & first_release_date < ${releaseWindowEnd} & cover != null & hypes >= 20 & game_type = 0 & version_parent = null;`,
      "sort first_release_date asc;",
      `limit ${safeLimit};`,
    ].join(" "),
  );

  return games.map(normalizeGame);
}

export async function getIgdbGameRecommendations(gameId: number, limit = 10) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
  const games = await requestGames(
    [
      "fields similar_games.id,similar_games.name,similar_games.slug,similar_games.summary,similar_games.first_release_date,similar_games.cover.url,similar_games.platforms.name,similar_games.genres.name,similar_games.game_modes.name,similar_games.artworks.url,similar_games.artworks.width,similar_games.artworks.height,similar_games.screenshots.url;",
      `where id = ${gameId};`,
      "limit 1;",
    ].join(" "),
  );

  return (games[0]?.similar_games ?? [])
    .slice(0, safeLimit)
    .map(normalizeRecommendation);
}

export async function getIgdbGamePlaytimes(gameIds: readonly number[]) {
  const safeGameIds = [...new Set(gameIds)]
    .filter((gameId) => Number.isInteger(gameId) && gameId > 0)
    .slice(0, 20);

  if (safeGameIds.length === 0) return [];

  const records = await requestIgdb<IgdbGameTimeToBeat>(
    "game_time_to_beats",
    [
      "fields game_id,hastily,normally,completely,count;",
      `where game_id = (${safeGameIds.join(",")});`,
      `limit ${safeGameIds.length};`,
    ].join(" "),
  );

  return records.map(
    (record) =>
      ({
        completionistSeconds: record.completely || null,
        gameId: record.game_id,
        mainPlusExtrasSeconds: record.normally || null,
        mainStorySeconds: record.hastily || null,
        submissions: record.count ?? 0,
      }) satisfies GamePlaytime,
  );
}

export async function getIgdbGame(gameId: number) {
  const games = await requestGames(
    `fields id,name,slug,summary,first_release_date,cover.url,platforms.name,genres.name,game_modes.name,screenshots.url,videos.name,videos.video_id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,websites.url,websites.type.type; where id = ${gameId}; limit 1;`,
  );
  if (!games[0]) return null;

  let estimatedPlaytime: GameSearchResult["estimatedPlaytime"] = null;

  try {
    const records = await requestIgdb<IgdbGameTimeToBeat>(
      "game_time_to_beats",
      `fields game_id,hastily,normally,completely,count; where game_id = ${gameId}; limit 1;`,
    );
    const record = records[0];

    if (record && (record.hastily || record.normally || record.completely)) {
      estimatedPlaytime = {
        completionistSeconds: record.completely || null,
        mainPlusExtrasSeconds: record.normally || null,
        mainStorySeconds: record.hastily || null,
        submissions: record.count ?? 0,
      };
    }
  } catch (error) {
    console.warn("Unable to load IGDB playtime estimates", error);
  }

  return { ...normalizeGame(games[0]), estimatedPlaytime };
}
