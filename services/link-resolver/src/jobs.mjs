import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.mjs";
import { downloadVideo, extractMetadata } from "./extract.mjs";
import { detectFromMetadata, detectFromVideo } from "./gemini.mjs";

const JOB_TTL_MS = 24 * 60 * 60 * 1_000;

async function atomicWrite(filename, value) {
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(temporary, filename);
}

export class JobStore {
  #jobs = new Map();
  #queue = [];
  #processing = false;

  constructor() {
    this.jobsDirectory = path.join(config.dataDirectory, "jobs");
    this.mediaDirectory = path.join(config.dataDirectory, "media");
  }

  async initialize() {
    await fs.mkdir(this.jobsDirectory, { recursive: true, mode: 0o700 });
    await fs.mkdir(this.mediaDirectory, { recursive: true, mode: 0o700 });
    const files = await fs.readdir(this.jobsDirectory);
    for (const filename of files.filter((item) => item.endsWith(".json"))) {
      try {
        const job = JSON.parse(
          await fs.readFile(path.join(this.jobsDirectory, filename), "utf8"),
        );
        if (Date.now() - Date.parse(job.createdAt) > JOB_TTL_MS) {
          await fs.rm(path.join(this.jobsDirectory, filename), { force: true });
          continue;
        }
        if (job.status === "running" || job.status === "queued") {
          job.status = "queued";
          job.stage = "queued";
          this.#queue.push(job.id);
        }
        this.#jobs.set(job.id, job);
      } catch (error) {
        console.warn(JSON.stringify({ event: "job_load_failed", filename, error: error.message }));
      }
    }
    this.#drain();
  }

  async create(sourceUrl, platform) {
    const existingJob = [...this.#jobs.values()].find(
      (job) =>
        job.sourceUrl === sourceUrl.toString() &&
        ["queued", "running"].includes(job.status),
    );
    if (existingJob) return existingJob;

    const activeCount = [...this.#jobs.values()].filter((job) =>
      ["queued", "running"].includes(job.status),
    ).length;
    if (activeCount >= config.maxQueuedJobs) {
      const error = new Error("Resolver queue is full");
      error.status = 429;
      throw error;
    }

    const timestamp = new Date().toISOString();
    const job = {
      id: crypto.randomUUID(),
      sourceUrl: sourceUrl.toString(),
      platform,
      status: "queued",
      stage: "queued",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.#jobs.set(job.id, job);
    this.#queue.push(job.id);
    await this.#persist(job);
    this.#drain();
    return job;
  }

  get(id) {
    return this.#jobs.get(id) ?? null;
  }

  stats() {
    const jobs = [...this.#jobs.values()];
    return {
      queued: jobs.filter((job) => job.status === "queued").length,
      running: jobs.filter((job) => job.status === "running").length,
    };
  }

  async cleanup() {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.#jobs) {
      if (Date.parse(job.createdAt) >= cutoff || ["queued", "running"].includes(job.status)) {
        continue;
      }
      this.#jobs.delete(id);
      await fs.rm(this.#filename(id), { force: true });
      await fs.rm(path.join(this.mediaDirectory, id), { recursive: true, force: true });
    }
  }

  #filename(id) {
    return path.join(this.jobsDirectory, `${id}.json`);
  }

  async #persist(job) {
    job.updatedAt = new Date().toISOString();
    await atomicWrite(this.#filename(job.id), job);
  }

  async #update(job, values) {
    Object.assign(job, values);
    await this.#persist(job);
  }

  #drain() {
    if (this.#processing) return;
    this.#processing = true;
    queueMicrotask(async () => {
      try {
        while (this.#queue.length > 0) {
          const id = this.#queue.shift();
          const job = this.#jobs.get(id);
          if (!job || job.status !== "queued") continue;
          await this.#process(job);
        }
      } finally {
        this.#processing = false;
        if (this.#queue.length > 0) this.#drain();
      }
    });
  }

  async #process(job) {
    const startedAt = Date.now();
    const jobMediaDirectory = path.join(this.mediaDirectory, job.id);
    await this.#update(job, { status: "running", stage: "extracting" });
    console.info(JSON.stringify({ event: "job_started", id: job.id, platform: job.platform }));

    try {
      const sourceUrl = new URL(job.sourceUrl);
      const extraction = await extractMetadata(sourceUrl);
      await this.#update(job, {
        stage: "downloading",
        extractionWarnings: extraction.errors.slice(0, 3),
      });

      let detection;
      try {
        const video = await downloadVideo(
          sourceUrl,
          jobMediaDirectory,
          extraction.metadata,
        );
        await this.#update(job, { stage: "analyzing-video" });
        detection = await detectFromVideo(video, extraction.metadata);
      } catch (videoError) {
        await this.#update(job, {
          stage: "analyzing-metadata",
          videoWarning: videoError.message.slice(0, 500),
        });
        detection = await detectFromMetadata(extraction.metadata);
      }

      await this.#update(job, {
        status: "completed",
        stage: "completed",
        detection,
        durationMs: Date.now() - startedAt,
      });
      console.info(
        JSON.stringify({
          event: "job_completed",
          id: job.id,
          durationMs: Date.now() - startedAt,
          confidence: detection.confidence,
          hasTitle: Boolean(detection.title),
        }),
      );
    } catch (error) {
      await this.#update(job, {
        status: "failed",
        stage: "failed",
        error: error.message.slice(0, 500),
        durationMs: Date.now() - startedAt,
      });
      console.error(
        JSON.stringify({ event: "job_failed", id: job.id, error: error.message }),
      );
    } finally {
      await fs.rm(jobMediaDirectory, { recursive: true, force: true });
    }
  }
}
