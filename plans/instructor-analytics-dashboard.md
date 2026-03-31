# Plan: Instructor Analytics Dashboard

> Source PRD: `prds/instructor-analytics-dashboard.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: `/instructor` (updated with overview analytics), `/instructor/:courseId/analytics` (new). Time range via `?range=30d|90d|all` search param.
- **Schema**: No changes. All data exists in `purchases`, `enrollments`, `lessonProgress`, `quizAttempts`, `modules`, `lessons`, `users`.
- **Service**: `analyticsService.ts` + `analyticsService.test.ts` in `app/services/`. Single source of truth for all analytics queries -- no SQL in route loaders.
- **Time range**: Route layer converts `?range=` to `{ from, to }` Date params before calling service functions. `from`/`to` are optional, default to all time.
- **Definitions**: Completion = `enrollments.completedAt IS NOT NULL` / total enrolled. Drop-off = zero `lessonProgress` records for a lesson. Quiz pass rate = latest attempt per student per quiz.
- **Charts**: Client-side (Recharts). Server returns pre-aggregated `{ date: string, value: number }[]`.
- **Money**: `purchases.pricePaid` is cents -- convert to currency units before display.
- **Navigation**: Add "Analytics" tab to the existing `Tabs` component in `instructor.$courseId.tsx` (links to `/instructor/:courseId/analytics`).
- **Route file**: New route registered in `app/routes.ts` as `instructor.$courseId.analytics.tsx`.
- **Params convention**: Functions with multiple same-type params use object params per CLAUDE.md.
- **Test pattern**: Mock `~/db`, use `createTestDb()` + `seedBaseData()`, test against in-memory SQLite.

---

## Phase 1 -- Instructor overview shows course performance

**User stories**: 1, 2, 3, 4, 5, 6

### What to build

Create `analyticsService` with `getInstructorOverview({ instructorId, from, to })` returning total revenue, total enrollments, average completion rate, and a per-course breakdown (courseId, title, revenue, enrollments). Write full tests for this function: empty state, filtered vs unfiltered, date boundaries, multi-course isolation.

Update the `/instructor` route loader to call `getInstructorOverview` with the `?range=` param converted to dates. Render an analytics summary section above the existing course grid: three stat cards (revenue, enrollments, avg completion rate) and a per-course breakdown table. Add a time-range selector (30d / 90d / all) that resubmits the loader. Each course row links to `/instructor/:courseId/analytics`.

### Done when

- `analyticsService.getInstructorOverview` returns correct aggregates; tests pass for empty state, date filtering, boundary conditions, and multi-course instructor.
- `/instructor` page renders stat cards and per-course breakdown with working time filter.
- Course rows link to the (not yet built) per-course analytics page.

---

## Phase 2 -- Per-course analytics: revenue, enrollments, completion

**User stories**: 7, 8, 9, 10, 11, 12, 16, 17, 18, 20

### What to build

Add three service functions to `analyticsService`:
- `getCourseRevenueSummary({ courseId, from, to })` -- total revenue + transactions array (student name, email, pricePaid, country, date)
- `getCourseEnrollmentSummary({ courseId, from, to })` -- total count + daily/weekly time series for charting
- `getCourseCompletionRate({ courseId, from, to })` -- percentage of enrolled students with `completedAt` set

Write tests for each: empty state, filtered vs unfiltered, date boundaries, partial completions.

Create `instructor.$courseId.analytics.tsx` route. Register in `app/routes.ts`. Single loader fetches all three summaries. Render:
- Stat cards (revenue, enrollments, completion rate) at the top
- Revenue over-time chart (Recharts) + sortable transaction table (date, student, email, amount, country)
- Enrollment over-time chart
- Time-range selector (30d / 90d / all)

Add "Analytics" link/tab to the instructor course navigation in `instructor.$courseId.tsx`.

### Done when

- All three service functions return correct data; tests pass including edge cases.
- `/instructor/:courseId/analytics` renders stat cards, revenue chart, transaction table, enrollment chart with working time filter.
- "Analytics" tab visible in course editor navigation.

---

## Phase 3 -- Quiz pass rates and lesson drop-off funnel

**User stories**: 13, 14, 15, 19

### What to build

Add two service functions to `analyticsService`:
- `getModuleQuizPassRates({ courseId, from, to })` -- per module: title, attempt count, pass percentage (using latest attempt per student per quiz)
- `getLessonDropoff({ courseId })` -- ordered list of lessons (by module position, then lesson position) with % of enrolled students who never started (no time filter)

Write tests for each: empty state, latest-attempt-per-student logic (retries don't inflate failures), drop-off ordering correctness, filtered quiz rates.

Add to the per-course analytics page:
- Module quiz pass rate table (module title, attempts, pass %)
- Lesson drop-off funnel chart ordered by lesson sequence

### Done when

- Both service functions return correct data; tests pass including retry logic and ordering.
- Per-course analytics page shows quiz pass rate table and drop-off funnel.
- All `analyticsService` functions have full test coverage.

---

## Out of Scope

- Real-time / live-updating metrics (no WebSockets or polling)
- Exporting analytics data to CSV or PDF
- Email digest reports for instructors
- Student-level drill-down from the drop-off funnel
- Revenue forecasting or projections
- Refund tracking or net revenue after refunds
- Cohort analysis or retention curves
- Period-over-period comparison (e.g. this month vs. last month)
- Admin-level analytics across all instructors

## Open Questions

None.
