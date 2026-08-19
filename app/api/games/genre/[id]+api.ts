import { isGameGenreId } from "@/constants/game-genres";
import { getIgdbGamesByGenre, IgdbRequestError } from "@/server/igdb";

const DEFAULT_LIMIT = 12;
const MAX_QUERY_LENGTH = 80;
const MAX_LIMIT = 20;
const MAX_OFFSET = 5_000;

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

type BrowseRequestBody = {
  limit?: unknown;
  offset?: unknown;
  query?: unknown;
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

async function getBrowseRequest(request: Request) {
  const url = new URL(request.url);
  const body =
    request.method === "POST"
      ? ((await request.json().catch(() => null)) as BrowseRequestBody | null)
      : null;
  const bodyQuery = typeof body?.query === "string" ? body.query : null;
  const query = (bodyQuery ?? url.searchParams.get("q") ?? "").trim();
  const requestedLimit = Number(
    body?.limit ?? url.searchParams.get("limit") ?? DEFAULT_LIMIT,
  );
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const requestedOffset = Number(
    body?.offset ?? url.searchParams.get("offset") ?? 0,
  );
  const offset = Number.isFinite(requestedOffset)
    ? Math.min(Math.max(Math.floor(requestedOffset), 0), MAX_OFFSET)
    : 0;

  return { limit, offset, query };
}

async function browseGenre(
  request: Request,
  { id }: { id: string },
) {
  const genreId = Number(id);
  if (!Number.isInteger(genreId) || !isGameGenreId(genreId)) {
    return json({ error: "Genre not found" }, { status: 404 });
  }

  const { limit, offset, query } = await getBrowseRequest(request);
  if (query.length > MAX_QUERY_LENGTH) {
    return json(
      { error: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }
  try {
    const games = await getIgdbGamesByGenre(genreId, limit, offset, query);

    return json({
      games,
    });
  } catch (error) {
    console.error("Genre browse failed", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unable to browse genre",
      },
      { status: error instanceof IgdbRequestError ? error.status : 500 },
    );
  }
}

export function GET(request: Request, context: { id: string }) {
  return browseGenre(request, context);
}

export function POST(request: Request, context: { id: string }) {
  return browseGenre(request, context);
}
