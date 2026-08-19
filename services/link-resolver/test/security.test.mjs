import assert from "node:assert/strict";
import test from "node:test";

import { socialPlatform } from "../src/security.mjs";

test("recognizes supported social domains without matching lookalikes", () => {
  assert.equal(socialPlatform(new URL("https://vm.tiktok.com/abc")), "tiktok");
  assert.equal(socialPlatform(new URL("https://www.instagram.com/reel/abc")), "instagram");
  assert.equal(socialPlatform(new URL("https://tiktok.com.evil.test/abc")), null);
  assert.equal(socialPlatform(new URL("https://notinstagram.com/abc")), null);
});
