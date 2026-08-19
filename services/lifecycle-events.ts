import { posthog } from "@/lib/posthog";

type EventProperty = boolean | number | string | null | undefined;
type EventProperties = Record<string, EventProperty>;

type PendingJourneyEvent = {
  name: string;
  properties: Record<string, boolean | number | string | null>;
};

type JourneyEventSender = (
  name: string,
  properties: PendingJourneyEvent["properties"],
) => void;

const pendingJourneyEvents: PendingJourneyEvent[] = [];
const MAX_PENDING_EVENTS = 32;
let journeyEventSender: JourneyEventSender | null = null;

function compactProperties(properties: EventProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter((entry) => entry[1] !== undefined),
  ) as Record<string, boolean | number | string | null>;
}

function sendJourneyEvent(event: PendingJourneyEvent) {
  if (!journeyEventSender) return;

  try {
    journeyEventSender(event.name, event.properties);
  } catch (error) {
    if (__DEV__) {
      console.warn(`Unable to send OneSignal event ${event.name}.`, error);
    }
  }
}

export function setLifecycleJourneyEventSender(sender: JourneyEventSender) {
  journeyEventSender = sender;

  for (const event of pendingJourneyEvents.splice(0)) {
    sendJourneyEvent(event);
  }
}

export function trackLifecycleEvent(
  name: string,
  properties: EventProperties = {},
  options: { journey?: boolean } = {},
) {
  const compacted = compactProperties(properties);

  try {
    posthog?.capture(name, compacted);
  } catch (error) {
    if (__DEV__) {
      console.warn(`Unable to capture PostHog event ${name}.`, error);
    }
  }

  if (!options.journey || process.env.EXPO_OS === "web") return;

  const event = { name, properties: compacted };
  if (journeyEventSender) {
    sendJourneyEvent(event);
    return;
  }

  pendingJourneyEvents.push(event);
  if (pendingJourneyEvents.length > MAX_PENDING_EVENTS) {
    pendingJourneyEvents.shift();
  }
}
