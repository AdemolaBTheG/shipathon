import { eq } from "drizzle-orm";

import { db } from "./client";
import { widgetState } from "./schema";

const STATE_ID = "current";
let updateQueue = Promise.resolve();

export type PersistedWidgetState = {
  isPro: boolean;
  tonightPickGameId: number | null;
  updatedAt: Date;
};

function createDefaultWidgetState(): PersistedWidgetState {
  return {
    isPro: false,
    tonightPickGameId: null,
    updatedAt: new Date(),
  };
}

function toValues(state: PersistedWidgetState) {
  return {
    id: STATE_ID,
    isPro: state.isPro,
    tonightPickGameId: state.tonightPickGameId,
    updatedAt: state.updatedAt,
  };
}

export async function getWidgetState(): Promise<PersistedWidgetState> {
  const [row] = await db
    .select()
    .from(widgetState)
    .where(eq(widgetState.id, STATE_ID))
    .limit(1);

  if (row) {
    return {
      isPro: row.isPro,
      tonightPickGameId: row.tonightPickGameId,
      updatedAt: row.updatedAt,
    };
  }

  const initialState = createDefaultWidgetState();
  await db.insert(widgetState).values(toValues(initialState));
  return initialState;
}

export function updateWidgetState(
  patch: Partial<Pick<PersistedWidgetState, "isPro" | "tonightPickGameId">>,
) {
  const operation = updateQueue.then(async () => {
    const current = await getWidgetState();
    const next: PersistedWidgetState = {
      ...current,
      ...patch,
      updatedAt: new Date(),
    };
    const values = toValues(next);

    await db
      .insert(widgetState)
      .values(values)
      .onConflictDoUpdate({
        target: widgetState.id,
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

export function setTonightPickGameId(gameId: number | null) {
  return updateWidgetState({ tonightPickGameId: gameId });
}
