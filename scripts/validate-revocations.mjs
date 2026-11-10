#!/usr/bin/env node
// Validates revocations.json the way the OpenMapX API reads it, and rejects what
// the API would silently ignore, such as a misspelled list name.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ID = /^[a-z0-9][a-z0-9-]*$/;
const LISTS = { removed: ["id", "reason"], critical: ["id", "reason", "maxVersion"] };

export function validateRevocations(text) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return [`not valid JSON: ${error.message}`];
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return ["the document must be a JSON object with optional `removed` and `critical` lists"];
  }
  for (const key of Object.keys(data)) {
    if (!(key in LISTS)) errors.push(`unknown top-level key "${key}"`);
  }
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
      if (typeof entry.id !== "string" || !ID.test(entry.id)) {
        errors.push(`${where}.id must be a lowercase, hyphen-separated extension id`);
      } else if (seen.has(entry.id)) {
        errors.push(`${where}.id "${entry.id}" is already listed in ${seen.get(entry.id)}`);
      } else {
        seen.set(entry.id, where);
      }
      for (const field of ["reason", "maxVersion"]) {
        if (Object.hasOwn(entry, field) && typeof entry[field] !== "string") {
          errors.push(`${where}.${field} must be text`);
        }
      }
    });
  }
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
