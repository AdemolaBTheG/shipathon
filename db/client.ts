import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "./schema";

// Keep the original filename so updating users retain their local libraries.
export const expoDb = openDatabaseSync("savepoint.db", {
  enableChangeListener: true,
});

export const db = drizzle(expoDb, { schema });
