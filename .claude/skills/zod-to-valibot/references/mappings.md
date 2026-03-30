# Zod → Valibot Mappings

## Import

```ts
// Zod
import { z } from 'zod';

// Valibot
import * as v from 'valibot';
```

## Core Pattern: Method Chaining → Functional Pipes

```ts
// Zod: method chaining
z.string().email().min(5).max(100)

// Valibot: pipe()
v.pipe(v.string(), v.email(), v.minLength(5), v.maxLength(100))
```

## Schema Types

| Zod | Valibot |
|---|---|
| `z.string()` | `v.string()` |
| `z.number()` | `v.number()` |
| `z.boolean()` | `v.boolean()` |
| `z.bigint()` | `v.bigint()` |
| `z.date()` | `v.date()` |
| `z.symbol()` | `v.symbol()` |
| `z.undefined()` | `v.undefined()` |
| `z.null()` | `v.null()` |
| `z.void()` | `v.void()` |
| `z.any()` | `v.any()` |
| `z.unknown()` | `v.unknown()` |
| `z.never()` | `v.never()` |
| `z.nan()` | `v.nan()` |
| `z.literal('x')` | `v.literal('x')` |
| `z.object({...})` | `v.object({...})` |
| `z.array(s)` | `v.array(s)` |
| `z.tuple([a, b])` | `v.tuple([a, b])` |
| `z.record(k, v)` | `v.record(k, v)` |
| `z.map(k, v)` | `v.map(k, v)` |
| `z.set(s)` | `v.set(s)` |
| `z.promise(s)` | `v.promise(s)` |
| `z.lazy(() => s)` | `v.lazy(() => s)` |
| `z.instanceof(C)` | `v.instance(C)` |
| `z.custom(fn)` | `v.custom(fn)` |

## Enums (Name Changes!)

| Zod | Valibot | Why |
|---|---|---|
| `z.enum(['a', 'b'])` | `v.picklist(['a', 'b'])` | `enum` reserved for TS enums |
| `z.nativeEnum(E)` | `v.enum(E)` | Valibot uses `enum` for TS enums |

## String Validations

| Zod | Valibot |
|---|---|
| `.email()` | `v.email()` |
| `.url()` | `v.url()` |
| `.uuid()` | `v.uuid()` |
| `.cuid2()` | `v.cuid2()` |
| `.ulid()` | `v.ulid()` |
| `.regex(re)` | `v.regex(re)` |
| `.min(n)` | `v.minLength(n)` |
| `.max(n)` | `v.maxLength(n)` |
| `.length(n)` | `v.length(n)` |
| `.startsWith(s)` | `v.startsWith(s)` |
| `.endsWith(s)` | `v.endsWith(s)` |
| `.includes(s)` | `v.includes(s)` |
| `.trim()` | `v.trim()` |
| `.toLowerCase()` | `v.toLowerCase()` |
| `.toUpperCase()` | `v.toUpperCase()` |
| `.ip()` | `v.ip()` / `v.ipv4()` / `v.ipv6()` |
| `.datetime()` | `v.isoDateTime()` / `v.isoTimestamp()` |

## Number Validations

| Zod | Valibot |
|---|---|
| `.min(n)` / `.gte(n)` | `v.minValue(n)` |
| `.max(n)` / `.lte(n)` | `v.maxValue(n)` |
| `.gt(n)` | `v.gtValue(n)` |
| `.lt(n)` | `v.ltValue(n)` |
| `.int()` | `v.integer()` |
| `.positive()` | `v.minValue(1)` or `v.gtValue(0)` |
| `.negative()` | `v.maxValue(-1)` or `v.ltValue(0)` |
| `.nonnegative()` | `v.minValue(0)` |
| `.nonpositive()` | `v.maxValue(0)` |
| `.finite()` | `v.finite()` |
| `.safe()` | `v.safeInteger()` |
| `.multipleOf(n)` | `v.multipleOf(n)` |

## Array Validations

| Zod | Valibot |
|---|---|
| `.min(n)` | `v.minLength(n)` |
| `.max(n)` | `v.maxLength(n)` |
| `.length(n)` | `v.length(n)` |
| `.nonempty()` | `v.nonEmpty()` |

## Modifiers

| Zod | Valibot | Notes |
|---|---|---|
| `s.optional()` | `v.optional(s)` | Wraps, doesn't chain |
| `s.nullable()` | `v.nullable(s)` | |
| `s.nullish()` | `v.nullish(s)` | |
| `s.default(val)` | `v.optional(s, val)` | Default is 2nd arg to `optional()` |
| `s.catch(val)` | `v.fallback(s, val)` | Name change |
| `z.coerce.number()` | `v.pipe(v.unknown(), v.transform(Number))` | No dedicated coerce API |
| `z.coerce.string()` | `v.pipe(v.unknown(), v.transform(String))` | |
| `z.coerce.date()` | `v.pipe(v.unknown(), v.transform(v => new Date(v)))` | |

## Object Methods

| Zod | Valibot | Notes |
|---|---|---|
| `s.pick({a: true})` | `v.pick(s, ['a'])` | Object-keys → array |
| `s.omit({a: true})` | `v.omit(s, ['a'])` | Object-keys → array |
| `s.partial()` | `v.partial(s)` | |
| `s.required()` | `v.required(s)` | |
| `s.extend({...})` | `v.object({...a.entries, ...b.entries})` | No extend — use spread |
| `s.merge(other)` | `v.object({...a.entries, ...b.entries})` | No merge — use spread |
| `s.keyof()` | `v.keyof(s)` | |
| `s.shape` | `s.entries` | Property rename |
| `s.strict()` | `v.strictObject({...})` | Must choose function upfront |
| `s.passthrough()` | `v.looseObject({...})` | Must choose function upfront |
| `s.strip()` | `v.object({...})` | Default behavior |
| `s.catchall(s)` | `v.objectWithRest({...}, s)` | Different function |

## Union / Intersection

| Zod | Valibot |
|---|---|
| `z.union([a, b])` | `v.union([a, b])` |
| `s.or(other)` | `v.union([s, other])` |
| `z.discriminatedUnion('type', [...])` | `v.variant('type', [...])` |
| `z.intersection(a, b)` | `v.intersect([a, b])` |
| `s.and(other)` | `v.intersect([s, other])` |

## Transformations

| Zod | Valibot |
|---|---|
| `.transform(fn)` | `v.transform(fn)` in pipe |
| `z.preprocess(fn, s)` | `v.pipe(v.unknown(), v.transform(fn), s)` |
| `.refine(fn, msg)` | `v.check(fn, msg)` in pipe |
| `.superRefine(fn)` | `v.rawCheck(fn)` or `v.rawTransform(fn)` |

## Parse / Validate

| Zod | Valibot | Notes |
|---|---|---|
| `s.parse(data)` | `v.parse(s, data)` | Schema first |
| `s.safeParse(data)` | `v.safeParse(s, data)` | Schema first |
| `s.parseAsync(data)` | `v.parseAsync(s, data)` | |
| `s.safeParseAsync(data)` | `v.safeParseAsync(s, data)` | |

## Type Inference

| Zod | Valibot |
|---|---|
| `z.infer<typeof s>` | `v.InferOutput<typeof s>` |
| `z.input<typeof s>` | `v.InferInput<typeof s>` |

## Error Handling

| Zod | Valibot |
|---|---|
| `ZodError` | `ValiError` |
| `error.issues` | `error.issues` |
| `error.flatten()` | `v.flatten(error.issues)` |
| `{ message: 'x' }` | String directly: `v.string('msg')` |

## Full Example

```ts
// ZOD
import { z } from 'zod';
const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
  role: z.enum(['admin', 'user']),
  tags: z.array(z.string()).nonempty(),
}).strict();
type User = z.infer<typeof UserSchema>;
const user = UserSchema.parse(data);

// VALIBOT
import * as v from 'valibot';
const UserSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  role: v.picklist(['admin', 'user']),
  tags: v.pipe(v.array(v.string()), v.nonEmpty()),
});
type User = v.InferOutput<typeof UserSchema>;
const user = v.parse(UserSchema, data);
```

## Codemod (Beta)

```bash
# Dry run
npx @valibot/zod-to-valibot src/**/* --dry

# Apply
npx @valibot/zod-to-valibot src/**/*
```

Review output — codemod misses edge cases.
