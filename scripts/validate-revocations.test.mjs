import assert from "node:assert/strict";
import { test } from "node:test";
import { validateRevocations } from "./validate-revocations.mjs";

const feed = (value) => ({ schemaVersion: 1, ...value });
const ok = (value) => assert.deepEqual(validateRevocations(JSON.stringify(value)), []);
const bad = (value, pattern) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const errors = validateRevocations(text);
  assert.ok(errors.length > 0, `expected ${text} to be rejected`);
  assert.match(errors.join("\n"), pattern);
};

test("accepts the empty feed and a populated one", () => {
  ok(feed({ removed: [], critical: [] }));
  ok(feed({}));
  ok(
    feed({
      removed: [{ id: "gone-ext", reason: "abandoned" }],
      critical: [{ id: "bad-ext", reason: "advisory", maxVersion: "1.2.0" }],
    }),
  );
  ok(feed({ critical: [{ id: "bad-ext", maxVersion: "2.0.0-rc.1" }] }));
});

test("rejects a missing or different format version", () => {
  bad({ removed: [], critical: [] }, /schemaVersion/);
  bad({ schemaVersion: 2 }, /schemaVersion/);
  bad({ schemaVersion: "1" }, /schemaVersion/);
});

test("rejects what the API would treat as unreadable", () => {
  bad("{not json", /valid JSON/);
  bad([], /JSON object/);
  bad(null, /JSON object/);
  bad(feed({ removed: "bad-ext" }), /must be a list/);
  bad(feed({ removed: [{ reason: "no id" }] }), /id must be/);
  bad(feed({ critical: [{ id: 7 }] }), /id must be/);
  bad(feed({ removed: [{ id: "a", reason: 1 }] }), /reason must be text/);
  bad(feed({ critical: [{ id: "a", maxVersion: 1 }] }), /maxVersion must be a semantic version/);
  bad(feed({ critical: [{ id: "a", maxVersion: "1.2" }] }), /maxVersion must be a semantic version/);
  bad(feed({ removed: ["a"] }), /must be an object/);
});

test("rejects what the API would silently ignore", () => {
  bad(feed({ critcal: [] }), /unknown top-level key/);
  bad(feed({ removed: [{ id: "a", maxVersion: "1.0.0" }] }), /unknown field/);
  bad(feed({ removed: [{ id: "A_B" }] }), /id must be/);
  bad(feed({ removed: [{ id: "a--b" }] }), /id must be/);
  bad(feed({ removed: [{ id: "x".repeat(49) }] }), /id must be/);
  bad(feed({ removed: [{ id: "a" }], critical: [{ id: "a" }] }), /already listed/);
});
