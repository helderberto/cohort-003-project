import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  courses,
  purchases,
  enrollments,
  users,
  modules,
  lessons,
  quizzes,
  quizAttempts,
  lessonProgress,
} from "~/db/schema";

export function getInstructorOverview({
  instructorId,
  from,
  to,
}: {
  instructorId: number;
  from?: Date;
  to?: Date;
}) {
  const instructorCourses = db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  let totalRevenue = 0;
  let totalEnrollments = 0;
  let completionRateSum = 0;
  let coursesWithEnrollments = 0;

  const coursesBreakdown = instructorCourses.map((course) => {
    const revenueConditions = [eq(purchases.courseId, course.id)];
    if (from) revenueConditions.push(gte(purchases.createdAt, from.toISOString()));
    if (to) revenueConditions.push(lte(purchases.createdAt, toEndOfDay(to)));

    const revenueRow = db
      .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
      .from(purchases)
      .where(and(...revenueConditions))
      .get()!;

    const enrollmentConditions = [eq(enrollments.courseId, course.id)];
    if (from) enrollmentConditions.push(gte(enrollments.enrolledAt, from.toISOString()));
    if (to) enrollmentConditions.push(lte(enrollments.enrolledAt, toEndOfDay(to)));

    const enrollmentRow = db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`sum(case when ${enrollments.completedAt} is not null then 1 else 0 end)`,
      })
      .from(enrollments)
      .where(and(...enrollmentConditions))
      .get()!;

    const courseRevenue = Number(revenueRow.total);
    const courseEnrollments = Number(enrollmentRow.total);
    const courseCompleted = Number(enrollmentRow.completed);

    totalRevenue += courseRevenue;
    totalEnrollments += courseEnrollments;

    if (courseEnrollments > 0) {
      completionRateSum += (courseCompleted / courseEnrollments) * 100;
      coursesWithEnrollments++;
    }

    return {
      courseId: course.id,
      title: course.title,
      revenue: courseRevenue,
      enrollments: courseEnrollments,
    };
  });

  const avgCompletionRate =
    coursesWithEnrollments > 0
      ? Math.round(completionRateSum / coursesWithEnrollments)
      : 0;

  // Aggregate revenue time series across all instructor courses
  const courseIds = instructorCourses.map((c) => c.id);
  let revenueTimeSeries: Array<{ date: string; value: number }> = [];

  if (courseIds.length > 0) {
    const tsConditions = [
      sql`${purchases.courseId} IN (${sql.raw(courseIds.join(","))})`,
    ];
    if (from) tsConditions.push(gte(purchases.createdAt, from.toISOString()));
    if (to) tsConditions.push(lte(purchases.createdAt, toEndOfDay(to)));

    const rows = db
      .select({
        date: sql<string>`substr(${purchases.createdAt}, 1, 10)`,
        value: sql<number>`sum(${purchases.pricePaid})`,
      })
      .from(purchases)
      .where(and(...tsConditions))
      .groupBy(sql`substr(${purchases.createdAt}, 1, 10)`)
      .orderBy(sql`substr(${purchases.createdAt}, 1, 10)`)
      .all();

    revenueTimeSeries = rows.map((r) => ({ date: r.date, value: Number(r.value) }));
  }

  return {
    totalRevenue,
    totalEnrollments,
    avgCompletionRate,
    courses: coursesBreakdown,
    revenueTimeSeries,
  };
}

// ─── Per-Course Analytics ───

export function getCourseRevenueSummary({
  courseId,
  from,
  to,
}: {
  courseId: number;
  from?: Date;
  to?: Date;
}) {
  const conditions = [eq(purchases.courseId, courseId)];
  if (from) conditions.push(gte(purchases.createdAt, from.toISOString()));
  if (to) conditions.push(lte(purchases.createdAt, toEndOfDay(to)));

  const totalRow = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(and(...conditions))
    .get()!;

  const transactions = db
    .select({
      studentName: users.name,
      studentEmail: users.email,
      pricePaid: purchases.pricePaid,
      country: purchases.country,
      date: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(users, eq(purchases.userId, users.id))
    .where(and(...conditions))
    .orderBy(purchases.createdAt)
    .all();

  const timeSeries = db
    .select({
      date: sql<string>`substr(${purchases.createdAt}, 1, 10)`,
      value: sql<number>`sum(${purchases.pricePaid})`,
    })
    .from(purchases)
    .where(and(...conditions))
    .groupBy(sql`substr(${purchases.createdAt}, 1, 10)`)
    .orderBy(sql`substr(${purchases.createdAt}, 1, 10)`)
    .all();

  return {
    totalRevenue: Number(totalRow.total),
    transactions,
    timeSeries: timeSeries.map((r) => ({ date: r.date, value: Number(r.value) })),
  };
}

export function getCourseEnrollmentSummary({
  courseId,
  from,
  to,
}: {
  courseId: number;
  from?: Date;
  to?: Date;
}) {
  const conditions = [eq(enrollments.courseId, courseId)];
  if (from) conditions.push(gte(enrollments.enrolledAt, from.toISOString()));
  if (to) conditions.push(lte(enrollments.enrolledAt, toEndOfDay(to)));

  const totalRow = db
    .select({ total: sql<number>`count(*)` })
    .from(enrollments)
    .where(and(...conditions))
    .get()!;

  const timeSeries = db
    .select({
      date: sql<string>`substr(${enrollments.enrolledAt}, 1, 10)`,
      value: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(and(...conditions))
    .groupBy(sql`substr(${enrollments.enrolledAt}, 1, 10)`)
    .orderBy(sql`substr(${enrollments.enrolledAt}, 1, 10)`)
    .all();

  return {
    totalEnrollments: Number(totalRow.total),
    timeSeries: timeSeries.map((r) => ({ date: r.date, value: Number(r.value) })),
  };
}

export function getCourseCompletionRate({
  courseId,
  from,
  to,
}: {
  courseId: number;
  from?: Date;
  to?: Date;
}) {
  const conditions = [eq(enrollments.courseId, courseId)];
  if (from) conditions.push(gte(enrollments.enrolledAt, from.toISOString()));
  if (to) conditions.push(lte(enrollments.enrolledAt, toEndOfDay(to)));

  const row = db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`sum(case when ${enrollments.completedAt} is not null then 1 else 0 end)`,
    })
    .from(enrollments)
    .where(and(...conditions))
    .get()!;

  const totalEnrolled = Number(row.total);
  const totalCompleted = Number(row.completed);
  const completionRate =
    totalEnrolled > 0
      ? Math.round((totalCompleted / totalEnrolled) * 10000) / 100
      : 0;

  return { totalEnrolled, totalCompleted, completionRate };
}

// ─── Quiz Pass Rates & Lesson Drop-off ───

export function getModuleQuizPassRates({
  courseId,
  from,
  to,
}: {
  courseId: number;
  from?: Date;
  to?: Date;
}) {
  const courseModules = db
    .select({ id: modules.id, title: modules.title, position: modules.position })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position)
    .all();

  if (courseModules.length === 0) return [];

  return courseModules.map((mod) => {
    // Get all quiz IDs in this module's lessons
    const moduleQuizIds = db
      .select({ id: quizzes.id })
      .from(quizzes)
      .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
      .where(eq(lessons.moduleId, mod.id))
      .all()
      .map((q) => q.id);

    if (moduleQuizIds.length === 0) {
      return { moduleTitle: mod.title, attemptCount: 0, passRate: 0 };
    }

    // Build date filter conditions for subquery
    let dateFilter = "";
    if (from) {
      dateFilter += ` AND qa.attempted_at >= '${from.toISOString()}'`;
    }
    if (to) {
      dateFilter += ` AND qa.attempted_at <= '${toEndOfDay(to)}'`;
    }

    const quizIdList = moduleQuizIds.join(",");

    // Latest attempt per student per quiz, then aggregate
    const result = db.all(sql.raw(`
      SELECT
        count(*) as attempt_count,
        sum(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as pass_count
      FROM (
        SELECT qa.user_id, qa.quiz_id, qa.passed
        FROM quiz_attempts qa
        WHERE qa.quiz_id IN (${quizIdList})${dateFilter}
        AND qa.attempted_at = (
          SELECT MAX(qa2.attempted_at)
          FROM quiz_attempts qa2
          WHERE qa2.user_id = qa.user_id
          AND qa2.quiz_id = qa.quiz_id${dateFilter.replace(/qa\./g, "qa2.")}
        )
        GROUP BY qa.user_id, qa.quiz_id
      )
    `)) as Array<{ attempt_count: number; pass_count: number }>;

    const row = result[0];
    const attemptCount = Number(row?.attempt_count ?? 0);
    const passCount = Number(row?.pass_count ?? 0);
    const passRate = attemptCount > 0 ? Math.round((passCount / attemptCount) * 100) : 0;

    return { moduleTitle: mod.title, attemptCount, passRate };
  });
}

export function getLessonDropoff({ courseId }: { courseId: number }) {
  // Get all lessons ordered by module position, then lesson position
  const orderedLessons = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position, lessons.position)
    .all();

  if (orderedLessons.length === 0) return [];

  // Count total enrolled students
  const enrolledRow = db
    .select({ total: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get()!;
  const totalEnrolled = Number(enrolledRow.total);

  if (totalEnrolled === 0) {
    return orderedLessons.map((l) => ({
      lessonTitle: l.lessonTitle,
      neverStartedPct: 0,
    }));
  }

  return orderedLessons.map((lesson) => {
    // Count students who have at least one lessonProgress record for this lesson
    const startedRow = db
      .select({ count: sql<number>`count(DISTINCT ${lessonProgress.userId})` })
      .from(lessonProgress)
      .where(eq(lessonProgress.lessonId, lesson.lessonId))
      .get()!;

    const started = Number(startedRow.count);
    const neverStarted = totalEnrolled - started;
    const neverStartedPct = Math.round((neverStarted / totalEnrolled) * 100);

    return { lessonTitle: lesson.lessonTitle, neverStartedPct };
  });
}

function toEndOfDay(date: Date): string {
  return `${date.toISOString().split("T")[0]}T23:59:59.999Z`;
}
