export type GameSearchResult = {
  id: number;
  name: string;
  slug: string | null;
  summary: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  platforms: string[];
  genres: string[];
  gameModes: string[];
  screenshots?: string[];
  trailerUrl?: string | null;
  trailerVideoId?: string | null;
  developers?: string[];
  publishers?: string[];
  websites?: GameWebsite[];
  estimatedPlaytime?: {
    completionistSeconds: number | null;
    mainPlusExtrasSeconds: number | null;
    mainStorySeconds: number | null;
    submissions: number;
  } | null;
};

export type GameRecommendation = GameSearchResult & {
  artworkUrl: string | null;
};

export type GamePlaytime = {
  completionistSeconds: number | null;
  gameId: number;
  mainPlusExtrasSeconds: number | null;
  mainStorySeconds: number | null;
  submissions: number;
};

export type GameWebsite = {
  type: string;
  url: string;
};

type GameSearchResponse = {
  games: GameSearchResult[];
};

type UpcomingGamesResponse = {
  games: GameSearchResult[];
};

type GameRecommendationsResponse = {
  games: GameRecommendation[];
};

type GamePlaytimesResponse = {
  playtimes: GamePlaytime[];
};

function getApiUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

  // Relative routes work on web; native builds should set the deployed API URL.
  return apiUrl ?? "";
}

export async function searchGames(
  query: string,
  options?: { limit?: number; offset?: number; signal?: AbortSignal },
) {
  const params = new URLSearchParams({ q: query });

  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  if (options?.offset) {
    params.set("offset", String(options.offset));
  }

  const response = await fetch(`${getApiUrl()}/api/games/search?${params}`, {
    signal: options?.signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | GameSearchResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Game search failed with status ${response.status}`,
    );
  }

  return (payload as GameSearchResponse).games;
}

export async function getGamesByGenre(
  genreId: number,
  options?: {
    limit?: number;
    offset?: number;
    query?: string;
    signal?: AbortSignal;
  },
) {
  const response = await fetch(
    `${getApiUrl()}/api/games/genre/${genreId}`,
    {
      body: JSON.stringify({
        limit: options?.limit,
        offset: options?.offset ?? 0,
        query: options?.query ?? "",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: options?.signal,
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | GameSearchResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Genre browse failed with status ${response.status}`,
    );
  }

  return (payload as GameSearchResponse).games;
}

export async function getGamesByPlatform(
  platformId: string,
  options?: {
    limit?: number;
    offset?: number;
    query?: string;
    signal?: AbortSignal;
  },
) {
  const response = await fetch(
    `${getApiUrl()}/api/games/platform/${platformId}`,
    {
      body: JSON.stringify({
        limit: options?.limit,
        offset: options?.offset ?? 0,
        query: options?.query ?? "",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: options?.signal,
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | GameSearchResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Platform browse failed with status ${response.status}`,
    );
  }

  return (payload as GameSearchResponse).games;
}

export async function getUpcomingGames(options?: {
  days?: number;
  limit?: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();

  if (options?.days) params.set("days", String(options.days));
  if (options?.limit) params.set("limit", String(options.limit));

  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : "";
  const response = await fetch(`${getApiUrl()}/api/games/upcoming${query}`, {
    signal: options?.signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | UpcomingGamesResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Upcoming games request failed with status ${response.status}`,
    );
  }

  return (payload as UpcomingGamesResponse).games;
}

export async function getGameRecommendations(
  id: number,
  options?: { limit?: number; signal?: AbortSignal },
) {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : "";
  const response = await fetch(
    `${getApiUrl()}/api/games/recommendations/${id}${query}`,
    { signal: options?.signal },
  );
  const payload = (await response.json().catch(() => null)) as
    | GameRecommendationsResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Recommendations request failed with status ${response.status}`,
    );
  }

  return (payload as GameRecommendationsResponse).games;
}

export async function getGamePlaytimes(
  gameIds: readonly number[],
  options?: { signal?: AbortSignal },
) {
  if (gameIds.length === 0) return [];

  const params = new URLSearchParams({ ids: gameIds.join(",") });
  const response = await fetch(`${getApiUrl()}/api/games/playtimes?${params}`, {
    signal: options?.signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | GamePlaytimesResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Game playtimes request failed with status ${response.status}`,
    );
  }

  return (payload as GamePlaytimesResponse).playtimes;
}

export async function getGame(
  id: number,
  options?: { signal?: AbortSignal },
) {
  const response = await fetch(`${getApiUrl()}/api/games/${id}`, {
    signal: options?.signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | GameSearchResult
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : `Game request failed with status ${response.status}`,
    );
  }

  return payload as GameSearchResult;
}
