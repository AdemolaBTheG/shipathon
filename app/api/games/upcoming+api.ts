import { getUpcomingIgdbGames, IgdbRequestError } from "@/server/igdb";

const DEFAULT_DAYS = 365;
const DEFAULT_LIMIT = 12;
const MAX_DAYS = 365;
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const requestedDays = Number(url.searchParams.get("days") ?? DEFAULT_DAYS);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const days = Number.isFinite(requestedDays)
    ? Math.min(Math.max(Math.floor(requestedDays), 30), MAX_DAYS)
    : DEFAULT_DAYS;

  try {
    return json(
      { games: await getUpcomingIgdbGames(limit, days) },
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=3600" } },
    );
  } catch (error) {
    console.error("Upcoming games request failed", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load upcoming games",
      },
      { status: error instanceof IgdbRequestError ? error.status : 500 },
    );
  }
}
