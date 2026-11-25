import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCatalog } from "./validate-catalog.mjs";

const entry = {
  id: "my-extension",
  name: "My Extension",
  manifest: "https://github.com/you/my-extension/releases/latest/download/extension.json",
};
const catalog = (value) => ({ schemaVersion: 1, extensions: [entry], ...value });
const ok = (value) => assert.deepEqual(validateCatalog(JSON.stringify(value)), []);
const bad = (value, pattern) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const errors = validateCatalog(text);
  assert.ok(errors.length > 0, `expected ${text} to be rejected`);
  assert.match(errors.join("\n"), pattern);
};

test("accepts a manifest entry, an inline entry and control lists", () => {
  ok(catalog({}));
  ok(catalog({ removed: [], critical: [{ id: "bad-ext", maxVersion: "1.2.0" }] }));
  ok(
    catalog({
      extensions: [
        {
          id: "inline-ext",
          name: "Inline",
          version: "1.0.0",
          integrations: [
            { artifact: "https://example.test/a.tar.gz", sha256: "a".repeat(64), id: "inline-a" },
          ],
        },
      ],
    }),
  );
});

test("accepts a pinned manifest entry with its version and digest", () => {
  const pinned = {
    id: "pinned-ext",
    name: "Pinned",
    version: "1.2.3",
    manifest: "https://github.com/you/pinned-ext/releases/download/v1.2.3/extension.json",
    manifestSha256: "c".repeat(64),
  };
  ok(catalog({ extensions: [pinned] }));
  bad(catalog({ extensions: [{ ...pinned, version: undefined }] }), /version is required for a pinned/);
  bad(catalog({ extensions: [{ ...pinned, manifestSha256: "c".repeat(63) }] }), /64-character/);
  bad(
    catalog({
      extensions: [
        {
          ...pinned,
          manifest: "https://github.com/you/pinned-ext/releases/latest/download/extension.json",
        },
      ],
    }),
    /releases\/latest/,
  );
  bad(catalog({ extensions: [{ ...entry, version: "1.0.0" }] }), /without manifestSha256/);
  bad(catalog({ extensions: [{ ...pinned, minPlatform: "1.0" }] }), /minPlatform/);
});

test("accepts only the versioned object form", () => {
  bad([entry], /JSON object/);
  bad({ extensions: [entry] }, /schemaVersion/);
  bad({ schemaVersion: 2, extensions: [entry] }, /schemaVersion/);
  bad(catalog({ extentions: [] }), /unknown top-level key/);
});

test("applies the component id grammar and semantic versions", () => {
  bad(catalog({ extensions: [{ ...entry, id: "my--ext" }] }), /id must be/);
  bad(catalog({ extensions: [{ ...entry, id: "x".repeat(49) }] }), /id must be/);
  bad(
    catalog({
      extensions: [
        {
          id: "inline-ext",
          name: "Inline",
          version: "1.0",
          services: [{ repo: "https://github.com/you/repo", service: "svc-" }],
        },
      ],
    }),
    /semantic version[\s\S]*service id/,
  );
  bad(catalog({ critical: [{ id: "bad-ext", maxVersion: "latest" }] }), /maxVersion/);
});
