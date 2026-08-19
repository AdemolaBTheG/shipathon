import { IgdbRequestError, searchIgdbGames } from "@/server/igdb";

const MAX_QUERY_LENGTH = 80;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const MAX_OFFSET = 5_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const requestedLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
  const offset = Number.isFinite(requestedOffset)
    ? Math.min(Math.max(Math.floor(requestedOffset), 0), MAX_OFFSET)
    : 0;

  if (!query) {
    return json({ error: "A search query is required" }, { status: 400 });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return json(
      { error: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  try {
    return json({ games: await searchIgdbGames(query, limit, offset) });
  } catch (error) {
    console.error("Game search failed", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unable to search for games",
      },
      { status: error instanceof IgdbRequestError ? error.status : 500 },
    );
  }
}
