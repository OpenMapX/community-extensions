#!/usr/bin/env node
// Validates revocations.json the way the OpenMapX API reads it, and rejects what
// the API would silently ignore, such as a misspelled list name.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The document format OpenMapX reads; a host refuses any other value. */
export const SCHEMA_VERSION = 1;
/** Extension, service and integration ids: a lowercase slug of at most 48 characters. */
export const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ID_MAX_LENGTH = 48;
// Semantic Versioning 2.0.0, without a leading "v".
export const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const LISTS = { removed: ["id", "reason"], critical: ["id", "reason", "maxVersion"] };

export function isId(value) {
  return typeof value === "string" && value.length <= ID_MAX_LENGTH && ID.test(value);
}

/** `schemaVersion` must be present and equal to the version this repository publishes. */
export function schemaVersionErrors(data) {
  return data.schemaVersion === SCHEMA_VERSION
    ? []
    : [`\`schemaVersion\` must be ${SCHEMA_VERSION}`];
}

/** Errors in the `removed` and `critical` lists of a catalog or revocation document. */
export function controlListErrors(data) {
  const errors = [];
  const seen = new Map();
  for (const [name, allowed] of Object.entries(LISTS)) {
    if (!Object.hasOwn(data, name)) continue;
    const list = data[name];
    if (!Array.isArray(list)) {
      errors.push(`\`${name}\` must be a list`);
      continue;
    }
    list.forEach((entry, index) => {
      const where = `${name}[${index}]`;
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        errors.push(`${where} must be an object`);
        return;
      }
      for (const key of Object.keys(entry)) {
        if (!allowed.includes(key)) errors.push(`${where} has unknown field "${key}"`);
      }
      if (!isId(entry.id)) {
        errors.push(
          `${where}.id must be a lowercase, hyphen-separated extension id of at most ${ID_MAX_LENGTH} characters`,
        );
      } else if (seen.has(entry.id)) {
        errors.push(`${where}.id "${entry.id}" is already listed in ${seen.get(entry.id)}`);
      } else {
        seen.set(entry.id, where);
      }
      if (Object.hasOwn(entry, "reason") && typeof entry.reason !== "string") {
        errors.push(`${where}.reason must be text`);
      }
      if (
        Object.hasOwn(entry, "maxVersion") &&
        (typeof entry.maxVersion !== "string" || !SEMVER.test(entry.maxVersion))
      ) {
        errors.push(`${where}.maxVersion must be a semantic version such as 1.2.0`);
      }
    });
  }
  return errors;
}

export function validateRevocations(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return [`not valid JSON: ${error.message}`];
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [
      "the document must be a JSON object with `schemaVersion` and optional `removed` and `critical` lists",
    ];
  }
  const errors = [...schemaVersionErrors(data)];
  for (const key of Object.keys(data)) {
    if (key !== "schemaVersion" && !(key in LISTS)) errors.push(`unknown top-level key "${key}"`);
  }
  errors.push(...controlListErrors(data));
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2] ?? "revocations.json";
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exit(1);
  }
  const errors = validateRevocations(text);
  if (errors.length > 0) {
    for (const error of errors) console.error(`${file}: ${error}`);
    process.exit(1);
  }
  console.log(`${file}: valid`);
}
