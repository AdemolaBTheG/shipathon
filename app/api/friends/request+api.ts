import {
  type PushDeliveryResult,
  sendOneSignalPush,
} from "@/server/one-signal";
import { getAuthenticatedSupabaseRequest } from "@/server/supabase-request";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}

export async function POST(request: Request) {
  const authenticated = await getAuthenticatedSupabaseRequest(request);
  if (!authenticated) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return json({ error: "An invite token is required" }, { status: 400 });
  }

  const { supabase, user } = authenticated;
  const { data: previews, error: previewError } = await supabase.rpc(
    "get_invite_preview",
    { invite_token: token },
  );
  const preview = previews?.[0];
  if (previewError || !preview) {
    return json(
      { error: previewError?.message ?? "This invitation is invalid or expired" },
      { status: 400 },
    );
  }

  const shouldNotify = preview.relationship_status === "available";
  const { data: friendRequestId, error: requestError } = await supabase.rpc(
    "request_friendship",
    { invite_token: token },
  );
  if (requestError) {
    return json({ error: requestError.message }, { status: 400 });
  }

  let notification: PushDeliveryResult | {
    reason: "existing-relationship";
    status: "skipped";
  } = { reason: "existing-relationship", status: "skipped" };
  if (shouldNotify && typeof friendRequestId === "string") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const displayName = profile?.display_name?.trim();
    const actorName = {
      de: displayName || "Ein Spieler",
      en: displayName || "A player",
      es: displayName || "Un jugador",
      fr: displayName || "Un joueur",
    };
    notification = await sendOneSignalPush({
      body: {
        de: "Öffne Joylogue, um zu antworten.",
        en: "Open Joylogue to respond.",
        es: "Abre Joylogue para responder.",
        fr: "Ouvrez Joylogue pour répondre.",
      },
      data: {
        actorId: user.id,
        friendRequestId,
        notificationType: "friend_request",
      },
      eventId: friendRequestId,
      recipientId: preview.owner_id,
      title: {
        de: `${actorName.de} möchte Backlogs vergleichen`,
        en: `${actorName.en} wants to compare backlogs`,
        es: `${actorName.es} quiere comparar listas`,
        fr: `${actorName.fr} veut comparer vos backlogs`,
      },
    });
  }

  return json({ friendRequestId, notification });
}
