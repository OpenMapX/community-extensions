# OpenMapX Community Extensions

The **curated catalog** for the OpenMapX unified extension store. Every entry listed here is surfaced to
self-hosted OpenMapX instances as a **`verified`** extension — an extension that ships integrations and/or
services as one versioned, pinned bundle.

> **Verified ≠ audited.** Inclusion here means the entry passed automated validation and an
> identity/ownership check (the inclusion PR). It is *not* a security audit. Extensions run third-party
> code: integrations run in-process with full access; services run as sandboxed containers. Install only
> what you trust.

OpenMapX instances read `catalog.json` from `main` by default
(`https://raw.githubusercontent.com/openmapx/community-extensions/main/catalog.json`). Operators can also add
their own catalog sources in **Admin → Extensions → Sources**; those are surfaced as the lower `community`
tier.

## Catalog format

`catalog.json` is an object:

```jsonc
{
  "extensions": [ /* ExtensionCatalogEntry[] */ ],
  "removed":    [ { "id": "...", "reason": "..." } ],            // delisted (hidden, banner on installed copies)
  "critical":   [ { "id": "...", "reason": "...", "maxVersion": "..." } ]  // kill-switch (offer to disable)
}
```

An entry carries only **editorial** metadata (how it appears in the store) plus a pointer to the
extension's own components. Everything developer-controlled — **`version`, `minPlatform`, the
components, and the release date** — comes from the extension's `extension.json`, *not* from this
catalog, so a new release never needs a catalog edit.

**Recommended — point `manifest` at a moving "latest release" url** (so updates flow from your
releases automatically):

```jsonc
{
  "id": "my-extension",                    // ^[a-z0-9][a-z0-9-]*$
  "name": "My Extension",
  "summary": "One line for the card.",
  "description": "A paragraph for the detail view.",
  "author": "You",
  "homepage": "https://github.com/you/my-extension",
  "categories": ["data-source"],
  "tags": ["example"],
  "featured": false,
  "manifest": "https://github.com/you/my-extension/releases/latest/download/extension.json"
}
```

The store reads `version`/`minPlatform`/components live from that manifest; a manifest entry must
**not** carry them (the validator rejects it). Point `manifest` at a pinned tag instead
(`…/releases/download/v1.2.3/extension.json`) if you want each version gated behind a catalog edit.

**Alternative — inline the components** (no `manifest`). Then the entry *does* declare its own
`version` and pins each part directly — and every release needs a catalog PR:

```jsonc
{
  "id": "my-extension", "name": "My Extension", "summary": "…", "categories": ["data-source"],
  "version": "1.0.0",
  "services":     [ { "repo": "https://github.com/you/my-extension", "ref": "v1.0.0", "service": "my-service" } ],
  "integrations": [ { "artifact": "https://…/my-integration.tar.gz", "sha256": "<hex>", "id": "my-integration" } ]
}
```

Services are pinned by git `ref` (tag/commit); integrations by `sha256`. See the OpenMapX
`extension.json` spec for the authoritative schema.

## Submitting an extension

1. Build your extension with `@openmapx/extension-cli` (`openmapx-ext package --bundle` emits an `extension.json`).
2. Open a pull request adding your entry to `catalog.json`.
3. CI validates the catalog (schema + reachable manifest/artifacts). A maintainer confirms ownership and merges.

That merge is what makes your extension `verified`.
