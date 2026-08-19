import {
  getIgdbGameRecommendations,
  IgdbRequestError,
} from "@/server/igdb";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

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

export async function GET(request: Request, { id }: { id: string }) {
  const gameId = Number(id);
  if (!Number.isInteger(gameId) || gameId < 1) {
    return json({ error: "A valid game ID is required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    return json(
      { games: await getIgdbGameRecommendations(gameId, limit) },
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=21600" } },
    );
  } catch (error) {
    console.error("Game recommendations request failed", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load game recommendations",
      },
      { status: error instanceof IgdbRequestError ? error.status : 500 },
    );
  }
}
