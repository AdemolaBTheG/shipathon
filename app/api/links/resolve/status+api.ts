import { getGameDetection, GeminiRequestError } from "@/server/gemini";
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
  if (contentLength > 6_144) {
    return json({ error: "Request is too large" }, { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as {
    jobId?: unknown;
    url?: unknown;
  } | null;
  const sourceUrl = parsePublicUrl(body?.url);
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  if (!sourceUrl || !jobId) {
    return json(
      { error: "A valid job ID and public web link are required" },
      { status: 400 },
    );
  }

  try {
    const job = await getGameDetection(jobId);
    if (job.status === "pending") {
      return json(
        { status: "pending", jobId, sourceUrl: sourceUrl.toString() },
        { status: 202 },
      );
    }

    const resolution = await resolveGameDetection(sourceUrl, job.detection);
    console.info("Completed link analysis", {
      confidence: job.detection.confidence,
      hostname: sourceUrl.hostname,
      jobId,
      status: resolution.status,
    });
    return json(resolution);
  } catch (error) {
    console.error("Unable to complete link analysis", error);
    const status =
      error instanceof GeminiRequestError || error instanceof IgdbRequestError
        ? error.status
        : 500;
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete link analysis",
      },
      { status },
    );
  }
}
