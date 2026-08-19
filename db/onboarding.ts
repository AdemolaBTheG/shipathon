import { eq } from "drizzle-orm";

import { db } from "./client";
import {
  onboardingState,
  type NotificationPreference,
  type OnboardingStep,
} from "./schema";

const STATE_ID = "current";
let updateQueue = Promise.resolve();

export type PersistedOnboardingState = {
  currentStep: OnboardingStep;
  notificationPreference: NotificationPreference;
  onboardingCompletedAt: Date | null;
  selectedGameCoverUrl: string | null;
  selectedGameId: number | null;
  selectedGameName: string | null;
  selectedPlatformIds: string[];
  updatedAt: Date;
};

export type OnboardingStatePatch = Partial<
  Omit<PersistedOnboardingState, "updatedAt">
>;

function parsePlatformIds(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function toState(row: typeof onboardingState.$inferSelect): PersistedOnboardingState {
  return {
    currentStep: row.currentStep,
    notificationPreference: row.notificationPreference,
    onboardingCompletedAt: row.onboardingCompletedAt,
    selectedGameCoverUrl: row.selectedGameCoverUrl,
    selectedGameId: row.selectedGameId,
    selectedGameName: row.selectedGameName,
    selectedPlatformIds: parsePlatformIds(row.selectedPlatformIdsJson),
    updatedAt: row.updatedAt,
  };
}

function toValues(state: PersistedOnboardingState) {
  return {
    id: STATE_ID,
    currentStep: state.currentStep,
    notificationPreference: state.notificationPreference,
    onboardingCompletedAt: state.onboardingCompletedAt,
    selectedGameCoverUrl: state.selectedGameCoverUrl,
    selectedGameId: state.selectedGameId,
    selectedGameName: state.selectedGameName,
    selectedPlatformIdsJson: JSON.stringify(state.selectedPlatformIds),
    updatedAt: state.updatedAt,
  };
}

export function createDefaultOnboardingState(): PersistedOnboardingState {
  return {
    currentStep: "welcome",
    notificationPreference: "unknown",
    onboardingCompletedAt: null,
    selectedGameCoverUrl: null,
    selectedGameId: null,
    selectedGameName: null,
    selectedPlatformIds: [],
    updatedAt: new Date(),
  };
}

export async function getOnboardingState() {
  const [row] = await db
    .select()
    .from(onboardingState)
    .where(eq(onboardingState.id, STATE_ID))
    .limit(1);

  if (row) return toState(row);

  const initialState = createDefaultOnboardingState();
  await db.insert(onboardingState).values(toValues(initialState));
  return initialState;
}

export function updateOnboardingState(patch: OnboardingStatePatch) {
  const operation = updateQueue.then(async () => {
    const current = await getOnboardingState();
    const next: PersistedOnboardingState = {
      ...current,
      ...patch,
      updatedAt: new Date(),
    };
    const values = toValues(next);

    await db
      .insert(onboardingState)
      .values(values)
      .onConflictDoUpdate({
        target: onboardingState.id,
        set: values,
      });

    return next;
  });

  updateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}
