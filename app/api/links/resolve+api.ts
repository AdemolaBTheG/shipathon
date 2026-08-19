import { GeminiRequestError, startGameDetection } from "@/server/gemini";
import { IgdbRequestError } from "@/server/igdb";
import { resolveGameDetection } from "@/server/link-resolution";
import { parsePublicUrl } from "@/server/public-url";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_096) {
    return json({ error: "Request is too large" }, { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
  } | null;
  const sourceUrl = parsePublicUrl(body?.url);
  if (!sourceUrl) {
    return json({ error: "A valid public web link is required" }, { status: 400 });
  }

  try {
    const startedAt = Date.now();
    const detection = await startGameDetection(sourceUrl);

    if (detection.status === "pending") {
      console.info("Started asynchronous link analysis", {
        durationMs: Date.now() - startedAt,
        hostname: sourceUrl.hostname,
        jobId: detection.jobId,
      });

      return json(
        {
          status: "pending",
          jobId: detection.jobId,
          sourceUrl: sourceUrl.toString(),
        },
        { status: 202 },
      );
    }

    const resolution = await resolveGameDetection(
      sourceUrl,
      detection.detection,
    );
    console.info("Completed synchronous link analysis", {
      confidence: detection.detection.confidence,
      durationMs: Date.now() - startedAt,
      hostname: sourceUrl.hostname,
      status: resolution.status,
    });
    return json(resolution);
  } catch (error) {
    console.error("Unable to start link analysis", error);
    const status =
      error instanceof GeminiRequestError || error instanceof IgdbRequestError
        ? error.status
        : 500;
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start link analysis",
      },
      { status },
    );
  }
}
