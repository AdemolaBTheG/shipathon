import { getIgdbGame, IgdbRequestError } from "@/server/igdb";

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

export async function GET(_request: Request, { id }: { id: string }) {
  const gameId = Number(id);
  if (!Number.isInteger(gameId) || gameId < 1) {
    return json({ error: "A valid game ID is required" }, { status: 400 });
  }

  try {
    const game = await getIgdbGame(gameId);
    return game
      ? json(game)
      : json({ error: "Game not found" }, { status: 404 });
  } catch (error) {
    console.error("Game request failed", error);
    return json(
      { error: error instanceof Error ? error.message : "Unable to load game" },
      { status: error instanceof IgdbRequestError ? error.status : 500 },
    );
  }
}
