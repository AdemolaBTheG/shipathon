import assert from "node:assert/strict";
import test from "node:test";

import { parseDetectionText } from "../src/detection.mjs";

const defaults = {
  confidence: 0.75,
  evidence: "Detected from video.",
  sourceKind: "video",
};

test("parses a structured detection", () => {
  const detection = parseDetectionText(
    JSON.stringify({
      title: "League of Legends",
      alternateTitles: ["LoL"],
      platformHint: "PC",
      confidence: 0.96,
      evidence: "The title screen is visible.",
      sourceKind: "video",
    }),
    defaults,
  );

  assert.equal(detection.title, "League of Legends");
  assert.equal(detection.confidence, 0.96);
});

test("parses JSON inside a markdown fence", () => {
  const detection = parseDetectionText(
    '```json\n{"title":"Hades","confidence":0.9}\n```',
    defaults,
  );

  assert.equal(detection.title, "Hades");
  assert.equal(detection.sourceKind, "video");
});

test("turns a bare title into a conservative detection", () => {
  const detection = parseDetectionText("League of Legends", defaults);

  assert.deepEqual(detection, {
    title: "League of Legends",
    alternateTitles: [],
    platformHint: null,
    confidence: 0.75,
    evidence: "Detected from video.",
    sourceKind: "video",
  });
});

test("accepts a JSON string title", () => {
  assert.equal(
    parseDetectionText('"Baldur\'s Gate 3"', defaults).title,
    "Baldur's Gate 3",
  );
});

test("rejects malformed structured output", () => {
  assert.throws(
    () => parseDetectionText("{title: League of Legends}", defaults),
    /invalid structured result/,
  );
});
