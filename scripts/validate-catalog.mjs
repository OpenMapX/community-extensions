#!/usr/bin/env node
// Inclusion gate: validate catalog.json structure before merge. Self-contained
// (no deps) so it runs on a bare Node. Exits non-zero with a clear message on
// the first batch of errors.
import { readFileSync } from "node:fs";

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const REF_RE = /^[a-zA-Z0-9._\-/]+$/;
const SHA256_RE = /^[a-f0-9]{64}$/i;

const errors = [];
const file = process.argv[2] ?? "catalog.json";
let doc;
try {
  doc = JSON.parse(readFileSync(file, "utf-8"));
} catch (e) {
  console.error(`✗ ${file} is not valid JSON: ${e.message}`);
  process.exit(1);
}

const entries = Array.isArray(doc) ? doc : (doc.extensions ?? []);
if (!Array.isArray(entries)) errors.push("`extensions` must be an array");

const seen = new Set();
for (const [i, e] of entries.entries()) {
  const at = `extensions[${i}]${e?.id ? ` (${e.id})` : ""}`;
  if (!e || typeof e !== "object") {
    errors.push(`${at}: must be an object`);
    continue;
  }
  if (!ID_RE.test(e.id ?? "")) errors.push(`${at}: invalid id`);
  if (seen.has(e.id)) errors.push(`${at}: duplicate id`);
  seen.add(e.id);
  if (!e.name) errors.push(`${at}: name is required`);
  // version/platform are developer-controlled and read live from the manifest —
  // a manifest entry must NOT carry them (keeps the catalog free of per-release
  // edits). Inline entries (no manifest) still declare their own version.
  if (!e.manifest && !e.version) {
    errors.push(`${at}: version is required for inline entries (no manifest)`);
  }
  if (e.manifest && (e.version || e.minPlatform || e.lastUpdated)) {
    errors.push(
      `${at}: a manifest entry must not carry version/minPlatform/lastUpdated — those come from the manifest`,
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
    if (!ID_RE.test(s.service ?? "")) errors.push(`${at}: invalid service id "${s.service}"`);
  }
  for (const ig of integrations) {
    if (!/^https:\/\//.test(ig.artifact ?? "")) errors.push(`${at}: integration artifact must be https`);
    if (ig.sha256 && !SHA256_RE.test(ig.sha256)) errors.push(`${at}: invalid sha256`);
    if (!ID_RE.test(ig.id ?? "")) errors.push(`${at}: invalid integration id`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} catalog error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ catalog.json OK — ${entries.length} extension(s).`);
