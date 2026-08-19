import crypto from "node:crypto";
import http from "node:http";

import { config } from "./config.mjs";
import { JobStore } from "./jobs.mjs";
import { parseSocialUrl, socialPlatform } from "./security.mjs";

const MAX_BODY_BYTES = 4_096;
const jobs = new JobStore();

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function authorized(request) {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(value.slice(7));
  const expected = Buffer.from(config.apiToken);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

async function requestBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.status = 400;
    throw error;
  }
}

function publicJob(job) {
  if (job.status === "completed") {
    return { status: "completed", detection: job.detection };
  }
  if (job.status === "failed") {
    return { status: "failed", error: job.error || "Link analysis failed" };
  }
  return { status: "pending", stage: job.stage };
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");

  try {
    if (request.method === "GET" && requestUrl.pathname === "/healthz") {
      json(response, 200, { status: "ok", ...jobs.stats() });
      return;
    }
    if (!authorized(request)) {
      json(response, 401, { error: "Unauthorized" });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/v1/jobs") {
      const body = await requestBody(request);
      const sourceUrl = await parseSocialUrl(body?.url);
      if (!sourceUrl) {
        json(response, 400, { error: "A public TikTok or Instagram URL is required" });
        return;
      }
      const job = await jobs.create(sourceUrl, socialPlatform(sourceUrl));
      json(response, 202, { status: "pending", jobId: job.id });
      return;
    }

    const jobMatch = requestUrl.pathname.match(/^\/v1\/jobs\/([a-f0-9-]{36})$/);
    if (request.method === "GET" && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) {
        json(response, 404, { error: "Job not found" });
        return;
      }
      json(response, job.status === "completed" ? 200 : 202, publicJob(job));
      return;
    }

    json(response, 404, { error: "Not found" });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    console.error(
      JSON.stringify({ event: "request_failed", path: requestUrl.pathname, error: error.message }),
    );
    json(response, status, { error: status >= 500 ? "Internal server error" : error.message });
  }
});

await jobs.initialize();
const cleanupTimer = setInterval(() => jobs.cleanup(), 60 * 60 * 1_000);
cleanupTimer.unref();

server.listen(config.port, config.host, () => {
  console.info(
    JSON.stringify({ event: "server_started", host: config.host, port: config.port }),
  );
});

function shutdown(signal) {
  console.info(JSON.stringify({ event: "server_stopping", signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
