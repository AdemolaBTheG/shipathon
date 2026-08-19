import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.mjs";
import { runProcess } from "./process.mjs";
import { socialPlatform } from "./security.mjs";

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

function trimmed(value, maxLength) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function decodeHtml(value) {
  return value
    ?.replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];
  return decodeHtml(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean));
}

async function readLimitedText(response, limit = 2 * 1024 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let length = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new Error("Page exceeded size limit");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function fetchHtmlMetadata(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Page returned HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Page did not return HTML");
  }

  const html = await readLimitedText(response);
  const titleTag = decodeHtml(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
  return {
    canonicalUrl: response.url,
    title: trimmed(metaContent(html, "og:title") || titleTag, 500),
    description: trimmed(
      metaContent(html, "og:description") || metaContent(html, "description"),
      4_000,
    ),
    uploader: null,
    durationSeconds: null,
    extractor: "html",
  };
}

async function fetchTikTokOEmbed(url) {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", url.toString());
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`TikTok oEmbed returned HTTP ${response.status}`);
  const payload = await response.json();
  return {
    canonicalUrl: url.toString(),
    title: trimmed(payload.title, 500),
    description: trimmed(payload.title, 4_000),
    uploader: trimmed(payload.author_name, 200),
    durationSeconds: null,
    extractor: "tiktok-oembed",
  };
}

async function extractWithYtDlp(url) {
  const { stdout } = await runProcess(
    config.ytDlpPath,
    [
      "--dump-single-json",
      "--skip-download",
      "--no-warnings",
      "--no-playlist",
      "--socket-timeout",
      "12",
      "--retries",
      "1",
      "--extractor-retries",
      "1",
      url.toString(),
    ],
    { timeoutMs: 45_000 },
  );
  const payload = JSON.parse(stdout);
  const item = Array.isArray(payload.entries) ? payload.entries[0] : payload;
  if (!item) throw new Error("No media entry was returned");

  return {
    canonicalUrl: trimmed(item.webpage_url || item.original_url, 2_048) || url.toString(),
    title: trimmed(item.title, 500),
    description: trimmed(item.description, 4_000),
    uploader: trimmed(item.uploader || item.channel, 200),
    durationSeconds:
      Number.isFinite(item.duration) && item.duration >= 0 ? item.duration : null,
    extractor: trimmed(item.extractor_key || item.extractor, 100) || "yt-dlp",
  };
}

function mergeMetadata(results, sourceUrl) {
  return results.reduce(
    (merged, value) => ({
      canonicalUrl: value.canonicalUrl || merged.canonicalUrl,
      title: value.title || merged.title,
      description: value.description || merged.description,
      uploader: value.uploader || merged.uploader,
      durationSeconds: value.durationSeconds ?? merged.durationSeconds,
      extractor: value.extractor || merged.extractor,
    }),
    {
      canonicalUrl: sourceUrl.toString(),
      title: null,
      description: null,
      uploader: null,
      durationSeconds: null,
      extractor: null,
    },
  );
}

export async function extractMetadata(sourceUrl) {
  const attempts = [extractWithYtDlp(sourceUrl), fetchHtmlMetadata(sourceUrl)];
  if (socialPlatform(sourceUrl) === "tiktok") {
    attempts.push(fetchTikTokOEmbed(sourceUrl));
  }
  const settled = await Promise.allSettled(attempts);
  const metadata = mergeMetadata(
    settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value),
    sourceUrl,
  );
  const errors = settled
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "Unknown extraction error");

  return { metadata, errors };
}

const VIDEO_MIME_TYPES = Object.freeze({
  ".avi": "video/avi",
  ".flv": "video/x-flv",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/mov",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpg",
  ".webm": "video/webm",
  ".wmv": "video/wmv",
});

export async function downloadVideo(sourceUrl, directory, metadata) {
  if (
    metadata.durationSeconds !== null &&
    metadata.durationSeconds > config.maxVideoDurationSeconds
  ) {
    throw new Error("Video exceeds duration limit");
  }

  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await runProcess(
    config.ytDlpPath,
    [
      "--no-playlist",
      "--no-warnings",
      "--socket-timeout",
      "15",
      "--retries",
      "1",
      "--extractor-retries",
      "1",
      "--max-filesize",
      String(config.maxVideoBytes),
      "--merge-output-format",
      "mp4",
      "--format",
      "bv*[height<=720]+ba/b[height<=720]/best[height<=720]/best",
      "--output",
      path.join(directory, "source.%(ext)s"),
      sourceUrl.toString(),
    ],
    { cwd: directory, timeoutMs: 120_000, maxOutputBytes: 2 * 1024 * 1024 },
  );

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const filename = entries.find(
    (entry) =>
      entry.isFile() &&
      !entry.name.endsWith(".part") &&
      VIDEO_MIME_TYPES[path.extname(entry.name).toLowerCase()],
  )?.name;
  if (!filename) throw new Error("No supported video file was downloaded");

  const filePath = path.join(directory, filename);
  const stats = await fs.stat(filePath);
  if (stats.size <= 0 || stats.size > config.maxVideoBytes) {
    throw new Error("Downloaded video has an invalid size");
  }

  return {
    filePath,
    mimeType: VIDEO_MIME_TYPES[path.extname(filename).toLowerCase()],
    size: stats.size,
  };
}
