import { eq } from "drizzle-orm";

import { db } from "./client";
import { featureUsage } from "./schema";

export const AI_LINK_RECOGNITION_FEATURE = "ai-link-recognition";
export const FREE_AI_LINK_RECOGNITIONS_PER_MONTH = 1;

function getLocalMonthPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export async function getMonthlyFeatureUsage(feature: string) {
  const period = getLocalMonthPeriod();
  const [usage] = await db
    .select({ count: featureUsage.count, period: featureUsage.period })
    .from(featureUsage)
    .where(eq(featureUsage.feature, feature))
    .limit(1);

  return {
    count: usage?.period === period ? usage.count : 0,
    period,
  };
}

export async function incrementMonthlyFeatureUsage(feature: string) {
  const current = await getMonthlyFeatureUsage(feature);
  const nextCount = current.count + 1;
  const values = {
    count: nextCount,
    feature,
    period: current.period,
    updatedAt: new Date(),
  };

  await db.insert(featureUsage).values(values).onConflictDoUpdate({
    target: featureUsage.feature,
    set: values,
  });

  return nextCount;
}
