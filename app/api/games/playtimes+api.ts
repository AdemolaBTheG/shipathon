import { getIgdbGamePlaytimes, IgdbRequestError } from "@/server/igdb";

const MAX_GAME_IDS = 20;

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...corsHeaders, ...init?.headers },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request: Request) {
  const rawIds = new URL(request.url).searchParams.get("ids") ?? "";
  const gameIds = rawIds
    .split(",")
    .map(Number)
    .filter((gameId) => Number.isInteger(gameId) && gameId > 0);

  if (gameIds.length === 0) {
    return json({ error: "At least one valid game ID is required" }, { status: 400 });
  }

  if (gameIds.length > MAX_GAME_IDS) {
    return json(
      { error: `A maximum of ${MAX_GAME_IDS} game IDs is allowed` },
      { status: 400 },
    );
  }

  try {
    return json(
      { playtimes: await getIgdbGamePlaytimes(gameIds) },
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=86400" } },
    );
  } catch (error) {
    console.error("Game playtimes request failed", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load game playtimes",
      },
      { status: error instanceof IgdbRequestError ? error.status : 500 },
    );
  }
}
