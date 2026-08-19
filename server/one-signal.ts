export type JoylogueNotificationData =
  | {
      actorId: string;
      friendRequestId: string;
      notificationType: "friend_request";
    }
  | {
      actorId: string;
      friendRequestId: string;
      notificationType: "friend_request_accepted";
    };

type SendPushOptions = {
  body: LocalizedPushText;
  data: JoylogueNotificationData;
  eventId: string;
  recipientId: string;
  title: LocalizedPushText;
};

export type LocalizedPushText = {
  de: string;
  en: string;
  es: string;
  fr: string;
};

export type PushDeliveryResult =
  | { status: "sent"; messageId: string }
  | { status: "skipped"; reason: "not-configured" | "no-subscription" }
  | { status: "failed"; reason: string };

async function createIdempotencyKey(eventId: string, eventType: string) {
  const input = new TextEncoder().encode(`${eventType}:${eventId}`);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", input));

  // OneSignal expects a UUID. Preserve deterministic retries while producing a v4 shape.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export async function sendOneSignalPush({
  body,
  data,
  eventId,
  recipientId,
  title,
}: SendPushOptions): Promise<PushDeliveryResult> {
  const appId =
    process.env.ONESIGNAL_APP_ID ?? process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return { reason: "not-configured", status: "skipped" };
  }

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      body: JSON.stringify({
        app_id: appId,
        contents: body,
        data,
        headings: title,
        idempotency_key: await createIdempotencyKey(
          eventId,
          data.notificationType,
        ),
        include_aliases: { external_id: [recipientId] },
        target_channel: "push",
      }),
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { errors?: unknown; id?: string }
      | null;

    if (!response.ok) {
      const details = payload?.errors
        ? JSON.stringify(payload.errors)
        : `OneSignal returned ${response.status}`;
      return { reason: details, status: "failed" };
    }

    if (!payload?.id) {
      return { reason: "no-subscription", status: "skipped" };
    }

    return { messageId: payload.id, status: "sent" };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : "Push delivery failed",
      status: "failed",
    };
  }
}
