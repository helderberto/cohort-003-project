# Instructor Analytics Dashboard

## Problem Statement

Instructors have no visibility into how their courses are performing. They cannot see how much revenue their courses have generated, how many students have enrolled, whether students are completing courses, how well students perform on quizzes, or at which point students abandon their learning journey. Without this data, instructors cannot make informed decisions about course improvements, pricing, or content strategy.

## Solution

Provide instructors with two analytics surfaces:

1. **Overview metrics on the existing `/instructor` page** — a summary across all their courses (total revenue, total enrollments, average completion rate) with a time filter and per-course breakdown.
2. **A dedicated per-course analytics page at `/instructor/:courseId/analytics`** — deep metrics for a single course including revenue charts and transactions, enrollment trends, completion rate, quiz pass rates per module, and a lesson-level drop-off funnel.

All metrics are filterable by time range: last 7 days, last 30 days, last 12 months, or all time (driven by a `?range=7d|30d|12m|all` URL search param).

## User Stories

1. As an instructor, I want to see total revenue across all my courses on the instructor overview page, so that I can understand my overall earnings at a glance.
2. As an instructor, I want to see total enrollments across all my courses on the instructor overview page, so that I can gauge overall student interest in my content.
3. As an instructor, I want to see the average completion rate across all my courses, so that I can understand whether students are finishing what they start.
4. As an instructor, I want to filter all overview metrics by last 7 days, last 30 days, last 12 months, or all time, so that I can track trends over different periods.
5. As an instructor, I want to see a per-course breakdown of revenue and enrollments on the overview page, so that I can compare performance across my courses.
6. As an instructor, I want to navigate from a course on the overview page to its detailed analytics, so that I can investigate a specific course more deeply.
7. As an instructor, I want to see total revenue for a specific course on its analytics page, so that I know exactly how much that course has earned.
8. As an instructor, I want to see a revenue chart over time for a specific course, so that I can identify growth trends or revenue drops.
9. As an instructor, I want to see a list of individual transactions for a course including student name, email, amount paid, country, and date, so that I have a full audit trail of purchases.
10. As an instructor, I want to see total enrollment count for a specific course, so that I know how many students have joined.
11. As an instructor, I want to see an enrollments-over-time chart for a specific course, so that I can see when enrollment spikes or slows.
12. As an instructor, I want to see the course completion rate as a percentage of enrolled students who finished all lessons, so that I can evaluate course retention.
13. As an instructor, I want to see quiz pass rates broken down by module, so that I can identify which modules students struggle with most.
14. As an instructor, I want to see a lesson-level drop-off funnel showing the percentage of enrolled students who never started each lesson, so that I can pinpoint exactly where students disengage.
15. As an instructor, I want the drop-off funnel to be ordered by lesson sequence, so that I can read the student journey from start to finish.
16. As an instructor, I want to filter all per-course analytics metrics by last 7 days, last 30 days, last 12 months, or all time, so that I can isolate performance in specific windows.
17. As an instructor, I want the analytics page to display summary stat cards (revenue, enrollments, completion rate) at the top, so that I get a quick overview before diving into charts.
18. As an instructor, I want charts to visually represent revenue and enrollment trends, so that I can identify patterns without reading raw numbers.
19. As an instructor, I want module-level quiz pass rate metrics to include the number of attempts and the pass percentage, so that I know both how often students try and how often they succeed.
20. As an instructor, I want the transaction table to be sortable by date and amount, so that I can find specific transactions quickly.

## Implementation Decisions

### New Modules

- **`analyticsService`** — A new service (with accompanying `.test.ts`) that owns all analytics query logic. Exposes:
  - `getInstructorOverview({ instructorId, from, to })` → total revenue, total enrollments, avg completion rate, per-course breakdown
  - `getCourseRevenueSummary({ courseId, from, to })` → total revenue + array of transactions with student name, email, price paid, country, date
  - `getCourseEnrollmentSummary({ courseId, from, to })` → total count + daily/weekly counts for charting
  - `getCourseCompletionRate({ courseId, from, to })` → percentage of enrolled students with `completedAt` set
  - `getModuleQuizPassRates({ courseId, from, to })` → per module: module title, attempt count, pass percentage
  - `getLessonDropoff({ courseId })` → ordered list of lessons with % of enrolled students who never started (no time filter — drop-off is structural)
  - All `from`/`to` parameters are optional and default to all time

- **`/instructor` route update** — Add overview analytics section above the course list. Fetch via server loader using `getInstructorOverview`. Include a time-range selector (7d / 30d / 12m / all) that resubmits the loader via `?range=` search param.

- **`/instructor/:courseId/analytics` route (new)** — Per-course analytics page. Single server loader call. Renders: stat cards, revenue chart + transaction table, enrollment chart, completion rate stat, module quiz pass rate table, lesson drop-off funnel chart. Add an "Analytics" tab to the per-course instructor navigation as a new dedicated tab.

### Architectural Decisions

- `analyticsService` is the single source of truth for analytics queries — no analytics SQL lives in route loaders directly.
- Time range filtering uses `from`/`to` Date parameters in service functions; the route layer converts `?range=7d|30d|12m|all` to concrete dates before calling services.
- **Drop-off definition**: a student is dropped off at lesson N if they have zero `lessonProgress` records for that lesson (never started). Lessons ordered by module position, then lesson position.
- **Completion rate definition**: enrolled students with `enrollments.completedAt IS NOT NULL` divided by total enrolled.
- **Quiz pass rate**: aggregate `quizAttempts` for all quizzes in a module's lessons, filtered by `attemptedAt`. Use latest attempt per student per quiz to avoid counting retries as failures.
- Revenue joins `purchases` to `users` to expose student name and email in the transaction list.
- Charts rendered client-side (e.g. Recharts); server returns pre-aggregated `{ date: string, value: number }[]` grouped by day or week depending on range.
- `?range=` search param (values: `7d`, `30d`, `12m`, `all`) makes analytics views shareable and bookmarkable.

### Schema Changes

None required. All data exists in `purchases`, `enrollments`, `lessonProgress`, `quizAttempts`, `modules`, `lessons`, `users`.

### Important Data Notes

- `purchases.pricePaid` is stored in cents — convert to currency units before display.
- `purchases` and `enrollments` are separate tables. Revenue counts only `purchases`; enrollment counts only `enrollments` (covers coupon redemptions and manual enrollments too).
- PPP pricing means the same course may have different `pricePaid` values per country — always show actual `pricePaid`, not list price.

## Testing Decisions

**What makes a good test**: test the public interface of `analyticsService` against a real in-memory SQLite database, consistent with how existing services are tested in this codebase. Seed known data and assert on returned values. Do not mock database calls. Do not test chart rendering or UI layout.

**Modules with required tests**:

- `analyticsService` — full coverage of every exported function.

**Test cases must cover**:

- Empty state (no purchases, no enrollments)
- Filtered vs. unfiltered results
- Date boundary conditions (purchase exactly on `from`/`to` boundary)
- Multi-course instructor (assert per-course isolation)
- Completion rate with partial completions
- Quiz pass rate using latest-attempt-per-student logic (retries don't count as extra failures)
- Drop-off ordering correctness (lessons sorted by module position, then lesson position)

**Prior art**: follow the pattern in existing service test files — seed the DB, call the service function, assert the result.

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

## Further Notes

- The drop-off funnel does not support time filtering — it reflects the cumulative structural drop-off across all enrolled students regardless of when they enrolled.
- The `/instructor` overview page change should be additive — no existing course list functionality should be removed or disrupted.
