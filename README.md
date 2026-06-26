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

Each entry either **inlines** its components or points at an authoritative `extension.json` via `manifest`:

```jsonc
{
  "id": "my-extension",                    // ^[a-z0-9][a-z0-9-]*$
  "name": "My Extension",
  "summary": "One line for the card.",
  "author": "You",
  "homepage": "https://github.com/you/my-extension",
  "categories": ["data-source"],
  "tags": ["example"],
  "version": "1.0.0",
  "minPlatform": "1.0",
  "lastUpdated": "2026-06-26T00:00:00Z",
  "featured": false,

  // EITHER inline the components …
  "services":     [ { "repo": "https://github.com/you/my-extension", "ref": "v1.0.0", "service": "my-service" } ],
  "integrations": [ { "artifact": "https://…/my-integration.tar.gz", "sha256": "<hex>", "id": "my-integration" } ]

  // … OR reference a hosted extension.json instead:
  // "manifest": "https://raw.githubusercontent.com/you/my-extension/main/extension.json"
}
```

Services are pinned by git `ref` (tag/commit); integrations are pinned by `sha256`. See the OpenMapX
`extension.json` spec for the authoritative schema.

## Submitting an extension

1. Build your extension with `@openmapx/extension-cli` (`openmapx-ext package --bundle` emits an `extension.json`).
2. Open a pull request adding your entry to `catalog.json`.
3. CI validates the catalog (schema + reachable manifest/artifacts). A maintainer confirms ownership and merges.

That merge is what makes your extension `verified`.
