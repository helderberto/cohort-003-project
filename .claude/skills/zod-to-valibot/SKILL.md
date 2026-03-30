---
name: zod-to-valibot
description: Migrate schemas from Zod to Valibot. Use when user asks to "migrate to valibot", "replace zod", "convert zod to valibot", or "/zod-to-valibot". Works across any repository. Don't use for writing new Valibot schemas from scratch.
---

# Zod to Valibot Migration

## Workflow

1. **Research current Valibot API** — `WebFetch` the [migration guide](https://valibot.dev/guides/migrate-from-zod/) and [API docs](https://valibot.dev/api/) to verify mappings are still current
2. **Scan** — find all Zod usage: `Grep` for `from 'zod'`, `from "zod"`, `z.object`, `z.string`, etc.
3. **Plan** — list files to migrate, flag edge cases (coerce, superRefine, extend/merge, discriminatedUnion)
4. **Migrate file-by-file** — apply patterns from [references/mappings.md](references/mappings.md); convert imports, schemas, validations, parse calls, type inference
5. **Update deps** — remove `zod`, add `valibot` in package.json
6. **Verify** — run `tsc` and tests; fix any type errors

## Rules

- Always research Valibot's current API before migrating — the library evolves fast
- Migrate one file at a time; run type-check between files
- Preserve all custom error messages
- Convert `.pick({a: true})` → `v.pick(schema, ['a'])` (object-keys → array)
- Convert `.extend()` / `.merge()` → spread: `v.object({...a.entries, ...b.entries})`
- Convert `.strict()` → `v.strictObject()`, `.passthrough()` → `v.looseObject()` (must change function, not add method)
- No Valibot equivalent for Zod's split `invalid_type_error`/`required_error` — collapse to single message

## Error Handling

- If `tsc` fails after migration → read error, check [mappings.md](references/mappings.md) for correct pattern
- If tests fail → compare old Zod behavior with new Valibot output; check error shape differences (`ZodError` → `ValiError`, `.flatten()` → `v.flatten()`)
- If a Zod pattern has no mapping → flag to user, wrap in `v.custom()` as escape hatch
