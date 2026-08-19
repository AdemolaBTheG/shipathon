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
    accept?: unknown;
    friendRequestId?: unknown;
  } | null;
  const friendRequestId =
    typeof body?.friendRequestId === "string"
      ? body.friendRequestId.trim()
      : "";
  const accept = body?.accept === true;
  if (!friendRequestId || typeof body?.accept !== "boolean") {
    return json({ error: "A request ID and response are required" }, { status: 400 });
  }

  const { supabase, user } = authenticated;
  const { data: pendingRequest, error: pendingRequestError } = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, status")
    .eq("id", friendRequestId)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pendingRequestError || !pendingRequest) {
    return json(
      { error: pendingRequestError?.message ?? "Pending friend request not found" },
      { status: 400 },
    );
  }

  const { data: accepted, error: responseError } = await supabase.rpc(
    "respond_to_friend_request",
    {
      accept_request: accept,
      friend_request_id: friendRequestId,
    },
  );
  if (responseError) {
    return json({ error: responseError.message }, { status: 400 });
  }

  let notification: PushDeliveryResult | {
    reason: "request-declined";
    status: "skipped";
  } = { reason: "request-declined", status: "skipped" };
  if (accept && accepted) {
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
        de: "Sieh dir an, was ihr beide gespielt habt.",
        en: "See what you have both been playing.",
        es: "Mira a qué habéis jugado los dos.",
        fr: "Découvrez les jeux auxquels vous avez joué tous les deux.",
      },
      data: {
        actorId: user.id,
        friendRequestId,
        notificationType: "friend_request_accepted",
      },
      eventId: friendRequestId,
      recipientId: pendingRequest.sender_id,
      title: {
        de: `${actorName.de} hat deine Freundschaftsanfrage angenommen`,
        en: `${actorName.en} accepted your friend request`,
        es: `${actorName.es} aceptó tu solicitud de amistad`,
        fr: `${actorName.fr} a accepté votre demande d’ami`,
      },
    });
  }

  return json({ accepted: Boolean(accepted), notification });
}
