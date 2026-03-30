# Instructor Analytics Dashboard — Implementation Plan

PRD: `prds/instructor-analytics-dashboard.md`

---

## Step 1: Install recharts

Add `recharts` for client-side charting. No other deps needed.

```sh
pnpm add recharts
```

**Verify:** `pnpm ls recharts` shows installed version.

---

## Step 2: `analyticsService` — tests first (red)

Create `app/services/analyticsService.test.ts` with tests for all six functions:

- `getInstructorOverview`
- `getCourseRevenueSummary`
- `getCourseEnrollmentSummary`
- `getCourseCompletionRate`
- `getModuleQuizPassRates`
- `getLessonDropoff`

Follow existing test patterns: `createTestDb()` + `seedBaseData()` from `app/test/setup.ts`. Seed purchases, enrollments, lessonProgress, quizAttempts per test.

**Test cases per PRD:**
- Empty state (no purchases, no enrollments)
- Filtered vs. unfiltered results (from/to dates)
- Date boundary conditions (purchase exactly on `from`/`to`)
- Multi-course instructor (per-course isolation)
- Completion rate with partial completions
- Quiz pass rate using latest-attempt-per-student logic
- Drop-off ordering (module position, then lesson position)

**Verify:** All tests fail (red). `pnpm vitest run app/services/analyticsService.test.ts`

---

## Step 3: `analyticsService` — implementation (green)

Create `app/services/analyticsService.ts` with all six functions. All use object params per CLAUDE.md convention.

**Key implementation details:**
- `pricePaid` is in cents — service returns cents, route/UI converts
- Revenue = `purchases` table; enrollments = `enrollments` table (separate)
- Completion = `enrollments.completedAt IS NOT NULL / total enrolled`
- Quiz pass rate = latest attempt per student per quiz (group by userId+quizId, max attemptedAt)
- Drop-off = no `lessonProgress` record for a lesson; no time filter
- Charts need `{ date: string, value: number }[]` grouped by day or week
- `from`/`to` optional, default to all time

**Verify:** All tests pass (green). `pnpm vitest run app/services/analyticsService.test.ts`

---

## Step 4: Refactor `analyticsService` if needed

Review service code for:
- Duplicated query fragments → extract helpers
- Complex SQL → add comments
- Consistent return shapes

**Verify:** Tests still green.

---

## Step 5: Time-range helper

Add a helper (in the analytics route or a shared util) to convert `?range=30d|90d|all` search param into `{ from?: Date, to?: Date }`. `to` is always now; `from` is now minus 30/90 days; `all` = no dates.

**Verify:** Unit test or inline — simple enough to verify in route tests.

---

## Step 6: `/instructor` overview — loader + UI

Update `app/routes/instructor.tsx`:

1. **Loader:** Call `getInstructorOverview({ instructorId, from, to })` using the `?range=` param. Pass data alongside existing loader data.
2. **UI:** Add an analytics summary section **above** the existing course list:
   - Three stat cards: total revenue, total enrollments, avg completion rate
   - Per-course breakdown table (course name, revenue, enrollments) with link to `/instructor/:courseId/analytics`
   - Time-range selector (30d / 90d / all time) that sets `?range=` and resubmits

**Important:** Additive change only — do not remove or break existing course list.

**Verify:** Screenshot before/after. Existing instructor page behavior preserved.

---

## Step 7: `/instructor/:courseId/analytics` — route + loader

Create `app/routes/instructor.$courseId.analytics.tsx`.

**Loader:** Single loader that calls all per-course analytics service functions in parallel (or sequentially if DB is synchronous):
- `getCourseRevenueSummary`
- `getCourseEnrollmentSummary`
- `getCourseCompletionRate`
- `getModuleQuizPassRates`
- `getLessonDropoff`

Convert `?range=` to `from`/`to` dates. Pass `getLessonDropoff` without time filter.

Auth: verify current user is the course instructor.

**Verify:** Loader returns expected shape. No UI yet — just data.

---

## Step 8: Analytics page — stat cards + time filter

Render at the top of the analytics page:
- Revenue stat card (convert cents to dollars)
- Enrollments stat card
- Completion rate stat card (percentage)
- Time-range selector (30d / 90d / all time)

**Verify:** Screenshot. Cards display correct data from loader.

---

## Step 9: Analytics page — revenue chart + transaction table

**Revenue chart:** Line/area chart (recharts) showing revenue over time from `getCourseRevenueSummary` daily data.

**Transaction table:** Student name, email, amount paid (formatted from cents), country, date. Sortable by date and amount (client-side sort).

**Verify:** Screenshot. Chart renders. Table is sortable.

---

## Step 10: Analytics page — enrollment chart

Line/area chart showing enrollments over time from `getCourseEnrollmentSummary` daily data.

**Verify:** Screenshot. Chart renders with correct data.

---

## Step 11: Analytics page — quiz pass rates table

Table with columns: module title, attempt count, pass percentage. Data from `getModuleQuizPassRates`.

**Verify:** Screenshot. Correct data per module.

---

## Step 12: Analytics page — lesson drop-off funnel

Bar/funnel chart showing per-lesson drop-off percentage. Ordered by module position then lesson position. Data from `getLessonDropoff`.

**Verify:** Screenshot. Lessons in correct order. Percentages make sense.

---

## Step 13: Navigation link

Add "Analytics" link to the per-course instructor navigation (alongside existing tabs like Modules, Students, etc.) pointing to `/instructor/:courseId/analytics`.

**Verify:** Link visible and navigates correctly.

---

## Step 14: Full verification

- `pnpm vitest run` — all tests pass
- `pnpm typecheck` — no type errors
- Manual walkthrough: instructor overview → per-course analytics → all sections
- Empty state: course with no purchases/enrollments shows zeros, no crashes
- Time filter: switching ranges updates all metrics

---

## Key References

| What | Where |
|---|---|
| DB schema | `app/db/schema.ts` |
| Service pattern | `app/services/courseService.ts` |
| Test pattern | `app/services/courseService.test.ts` |
| Test setup/seeding | `app/test/setup.ts` |
| Instructor routes | `app/routes/instructor.tsx`, `instructor.$courseId.tsx` |
| Auth pattern | `app/lib/session.ts` → `getCurrentUserId` |
| Validation | `app/lib/validation.ts` → `parseParams`, `parseFormData` |
| Route params | Valibot schemas in each route |
