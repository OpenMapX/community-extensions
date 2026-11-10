import assert from "node:assert/strict";
import { test } from "node:test";
import { validateRevocations } from "./validate-revocations.mjs";

const ok = (value) => assert.deepEqual(validateRevocations(JSON.stringify(value)), []);
const bad = (value, pattern) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const errors = validateRevocations(text);
  assert.ok(errors.length > 0, `expected ${text} to be rejected`);
  assert.match(errors.join("\n"), pattern);
};

test("accepts the empty feed and a populated one", () => {
  ok({ removed: [], critical: [] });
  ok({});
  ok({
    removed: [{ id: "gone-ext", reason: "abandoned" }],
    critical: [{ id: "bad-ext", reason: "advisory", maxVersion: "1.2.0" }],
  });
});

test("rejects what the API would treat as unreadable", () => {
  bad("{not json", /valid JSON/);
  bad([], /JSON object/);
  bad(null, /JSON object/);
  bad({ removed: "bad-ext" }, /must be a list/);
  bad({ removed: [{ reason: "no id" }] }, /id must be/);
  bad({ critical: [{ id: 7 }] }, /id must be/);
  bad({ removed: [{ id: "a", reason: 1 }] }, /reason must be text/);
  bad({ critical: [{ id: "a", maxVersion: 1 }] }, /maxVersion must be text/);
  bad({ removed: ["a"] }, /must be an object/);
});

test("rejects what the API would silently ignore", () => {
  bad({ critcal: [] }, /unknown top-level key/);
  bad({ removed: [{ id: "a", maxVersion: "1.0.0" }] }, /unknown field/);
  bad({ removed: [{ id: "A_B" }] }, /id must be/);
  bad({ removed: [{ id: "a" }], critical: [{ id: "a" }] }, /already listed/);
});
