import path from "node:path";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export const config = Object.freeze({
  host: process.env.HOST?.trim() || "127.0.0.1",
  port: positiveInteger("PORT", 8788),
  apiToken: required("RESOLVER_API_TOKEN"),
  geminiApiKey: required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite",
  dataDirectory: path.resolve(
    process.env.DATA_DIRECTORY?.trim() || "/var/lib/joylogue-resolver",
  ),
  ytDlpPath: process.env.YT_DLP_PATH?.trim() || "/usr/local/bin/yt-dlp",
  maxQueuedJobs: positiveInteger("MAX_QUEUED_JOBS", 20),
  maxVideoBytes: positiveInteger("MAX_VIDEO_BYTES", 80 * 1024 * 1024),
  maxVideoDurationSeconds: positiveInteger("MAX_VIDEO_DURATION_SECONDS", 300),
});
