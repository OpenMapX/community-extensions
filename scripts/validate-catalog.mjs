#!/usr/bin/env node
// Inclusion gate: validate catalog.json structure before merge. Self-contained
// (no deps) so it runs on a bare Node. Exits non-zero with a clear message on
// the first batch of errors.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  controlListErrors,
  ID_MAX_LENGTH,
  isId,
  SEMVER,
  schemaVersionErrors,
} from "./validate-revocations.mjs";

const REF_RE = /^[a-zA-Z0-9._\-/]+$/;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const TOP_LEVEL = ["schemaVersion", "extensions", "removed", "critical"];

export function validateCatalog(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return [`not valid JSON: ${e.message}`];
  }
  // OpenMapX reads only the object form; a bare list of entries is refused.
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return ["the catalog must be a JSON object with `schemaVersion` and an `extensions` list"];
  }
  const errors = [...schemaVersionErrors(doc)];
  for (const key of Object.keys(doc)) {
    if (!TOP_LEVEL.includes(key)) errors.push(`unknown top-level key "${key}"`);
  }
  errors.push(...controlListErrors(doc));

  const entries = doc.extensions ?? [];
  if (!Array.isArray(entries)) {
    errors.push("`extensions` must be an array");
    return errors;
  }

  const invalidId = `must be a lowercase, hyphen-separated id of at most ${ID_MAX_LENGTH} characters`;
  const seen = new Set();
  for (const [i, e] of entries.entries()) {
    const at = `extensions[${i}]${e?.id ? ` (${e.id})` : ""}`;
    if (!e || typeof e !== "object" || Array.isArray(e)) {
      errors.push(`${at}: must be an object`);
      continue;
    }
    if (!isId(e.id)) errors.push(`${at}: id ${invalidId}`);
    if (seen.has(e.id)) errors.push(`${at}: duplicate id`);
    seen.add(e.id);
    if (!e.name) errors.push(`${at}: name is required`);
    // A moving manifest entry reads version and platform live from the manifest,
    // so it must not carry them. A pinned manifest entry authorizes exact manifest
    // bytes: it names their SHA-256 and the version they declare, which OpenMapX
    // needs to treat the entry as verified. Inline entries declare their version.
    const pinned = e.manifestSha256 !== undefined;
    if (pinned && !e.manifest) {
      errors.push(`${at}: manifestSha256 needs a manifest URL`);
    }
    if (pinned && (typeof e.manifestSha256 !== "string" || !SHA256_RE.test(e.manifestSha256))) {
      errors.push(`${at}: manifestSha256 must be a 64-character hex SHA-256`);
    }
    if (pinned && typeof e.manifest === "string" && /\/releases\/latest\//.test(e.manifest)) {
      errors.push(`${at}: a pinned manifest must use a release tag URL, not releases/latest`);
    }
    if (!e.manifest && !e.version) {
      errors.push(`${at}: version is required for inline entries (no manifest)`);
    }
    if (pinned && e.manifest && !e.version) {
      errors.push(`${at}: version is required for a pinned manifest entry`);
    }
    if (e.version !== undefined && (typeof e.version !== "string" || !SEMVER.test(e.version))) {
      errors.push(`${at}: version must be a semantic version such as 1.0.0`);
    }
    if (e.manifest && !pinned && e.version) {
      errors.push(
        `${at}: a manifest entry without manifestSha256 must not carry version — it comes from the manifest`,
      );
    }
    if (e.manifest && (e.minPlatform || e.lastUpdated)) {
      errors.push(
        `${at}: a manifest entry must not carry minPlatform/lastUpdated — those come from the manifest`,
      );
    }

    const services = e.services ?? [];
    const integrations = e.integrations ?? [];
    const hasComponents = services.length + integrations.length > 0;
    if (!e.manifest && !hasComponents) {
      errors.push(`${at}: must declare a manifest URL or inline service/integration components`);
    }
    if (e.manifest && !/^https:\/\//.test(e.manifest)) {
      errors.push(`${at}: manifest must be an https URL`);
    }
    for (const s of services) {
      if (!/^https?:\/\/|^git:|^ssh:/.test(s.repo ?? "")) errors.push(`${at}: service repo must be a git URL`);
      if (s.ref && !REF_RE.test(s.ref)) errors.push(`${at}: invalid service ref "${s.ref}"`);
      if (!isId(s.service)) errors.push(`${at}: service id "${s.service}" ${invalidId}`);
    }
    for (const ig of integrations) {
      if (!/^https:\/\//.test(ig.artifact ?? "")) errors.push(`${at}: integration artifact must be https`);
      if (ig.sha256 && !SHA256_RE.test(ig.sha256)) errors.push(`${at}: invalid sha256`);
      if (!isId(ig.id)) errors.push(`${at}: integration id "${ig.id}" ${invalidId}`);
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2] ?? "catalog.json";
  let text;
  try {
    text = readFileSync(file, "utf-8");
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
    process.exit(1);
  }
  const errors = validateCatalog(text);
  if (errors.length) {
    console.error(`✗ ${errors.length} catalog error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ ${file} OK — ${JSON.parse(text).extensions?.length ?? 0} extension(s).`);
}
