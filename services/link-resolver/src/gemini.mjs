import fs from "node:fs/promises";

import { config } from "./config.mjs";
import { parseDetectionText } from "./detection.mjs";

const API_ROOT = "https://generativelanguage.googleapis.com";
const INTERACTIONS_URL = `${API_ROOT}/v1beta/interactions`;
const API_REVISION = "2026-05-20";

const detectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: ["string", "null"] },
    alternateTitles: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
    },
    platformHint: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "string" },
    sourceKind: { type: "string", enum: ["video", "page", "unknown"] },
  },
  required: [
    "title",
    "alternateTitles",
    "platformHint",
    "confidence",
    "evidence",
    "sourceKind",
  ],
};

const generateContentDetectionSchema = {
  type: "object",
  properties: {
    title: { type: "string", nullable: true },
    alternateTitles: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
    },
    platformHint: { type: "string", nullable: true },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "string" },
    sourceKind: { type: "string", enum: ["video", "page", "unknown"] },
  },
  required: [
    "title",
    "alternateTitles",
    "platformHint",
    "confidence",
    "evidence",
    "sourceKind",
  ],
};

function headers(extra = {}) {
  return {
    "Api-Revision": API_REVISION,
    "x-goog-api-key": config.geminiApiKey,
    ...extra,
  };
}

async function jsonRequest(url, init = {}, timeoutMs = 30_000) {
  const response = await fetch(url, {
    ...init,
    headers: headers(init.headers),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Gemini returned HTTP ${response.status}`,
    );
  }
  return payload;
}

function requestBody(input, { background = false } = {}) {
  return {
    model: config.geminiModel,
    background,
    ...(background ? { store: true } : {}),
    input,
    generation_config: { max_output_tokens: 500 },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: detectionSchema,
    },
  };
}

function outputText(interaction) {
  if (interaction?.output_text) return interaction.output_text;
  return interaction?.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === "text" && content.text)
    .map((content) => content.text)
    .join("");
}

function parseDetection(interaction, defaults) {
  const text = outputText(interaction);
  if (!text) {
    const stepError = interaction?.steps?.find((step) => step.error)?.error
      ?.message;
    throw new Error(stepError || interaction?.error?.message || "Gemini returned no result");
  }
  return parseDetectionText(text, defaults);
}

function metadataText(metadata) {
  return JSON.stringify(
    {
      canonicalUrl: metadata.canonicalUrl,
      title: metadata.title,
      description: metadata.description,
      uploader: metadata.uploader,
      durationSeconds: metadata.durationSeconds,
      extractor: metadata.extractor,
    },
    null,
    2,
  );
}

function detectionPrompt(metadata, hasVideo) {
  return [
    "Identify the primary released video game directly shown, played, reviewed, or discussed in this social post.",
    hasVideo
      ? "Use visible gameplay, title screens, captions, spoken audio, and supplied metadata as evidence."
      : "Use only the supplied page metadata as evidence.",
    "Return the exact game title, not a franchise, character, creator, platform, or guessed sequel.",
    "If direct evidence is insufficient, return title as null and confidence 0. Do not invent information.",
    `Source metadata:\n${metadataText(metadata)}`,
  ].join(" ");
}

async function createInteraction(input, background) {
  return jsonRequest(
    INTERACTIONS_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(input, { background })),
    },
    30_000,
  );
}

async function generateFromFile(file, prompt) {
  const payload = await jsonRequest(
    `${API_ROOT}/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                file_data: {
                  mime_type: file.mimeType,
                  file_uri: file.uri,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 500,
          responseMimeType: "application/json",
          responseSchema: generateContentDetectionSchema,
        },
      }),
    },
    180_000,
  );
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");
  if (!text) {
    throw new Error(
      payload?.promptFeedback?.blockReason
        ? `Gemini blocked the video: ${payload.promptFeedback.blockReason}`
        : "Gemini returned no video analysis",
    );
  }
  return parseDetectionText(text, {
    confidence: 0.75,
    evidence: "Gemini returned only the title detected from the analyzed video.",
    sourceKind: "video",
  });
}

async function uploadFile(filePath, mimeType) {
  const data = await fs.readFile(filePath);
  const startResponse = await fetch(`${API_ROOT}/upload/v1beta/files`, {
    method: "POST",
    headers: headers({
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(data.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
    }),
    body: JSON.stringify({ file: { display_name: "joylogue-social-video" } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!startResponse.ok) {
    const error = await startResponse.json().catch(() => null);
    throw new Error(error?.error?.message || "Unable to start Gemini upload");
  }
  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return an upload URL");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(data.length),
      "Content-Type": mimeType,
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: data,
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await uploadResponse.json().catch(() => null);
  if (!uploadResponse.ok || !payload?.file?.name) {
    throw new Error(payload?.error?.message || "Unable to upload video to Gemini");
  }
  return payload.file;
}

async function waitForFile(file) {
  const deadline = Date.now() + 120_000;
  let current = file;
  while (current.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    current = await jsonRequest(
      `${API_ROOT}/v1beta/${encodeURI(file.name)}`,
      {},
      15_000,
    );
  }
  if (current.state !== "ACTIVE") {
    throw new Error(`Gemini file ended with ${current.state || "unknown status"}`);
  }
  return current;
}

async function deleteFile(name) {
  await fetch(`${API_ROOT}/v1beta/${encodeURI(name)}`, {
    method: "DELETE",
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
}

export async function detectFromMetadata(metadata) {
  const interaction = await createInteraction(detectionPrompt(metadata, false), false);
  return parseDetection(interaction, {
    confidence: 0.6,
    evidence: "Gemini returned only the title detected from the source metadata.",
    sourceKind: "page",
  });
}

export async function detectFromVideo(video, metadata) {
  let uploadedFile;
  try {
    uploadedFile = await uploadFile(video.filePath, video.mimeType);
    const activeFile = await waitForFile(uploadedFile);
    return await generateFromFile(
      {
        uri: activeFile.uri,
        mimeType: activeFile.mimeType || video.mimeType,
      },
      detectionPrompt(metadata, true),
    );
  } finally {
    if (uploadedFile?.name) await deleteFile(uploadedFile.name);
  }
}
