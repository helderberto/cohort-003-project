import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getInstructorOverview,
  getCourseRevenueSummary,
  getCourseEnrollmentSummary,
  getCourseCompletionRate,
  getModuleQuizPassRates,
  getLessonDropoff,
} from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── getInstructorOverview ───

  describe("getInstructorOverview", () => {
    it("returns zeros for instructor with no data", () => {
      const result = getInstructorOverview({ instructorId: base.instructor.id });

      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
      expect(result.avgCompletionRate).toBe(0);
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].revenue).toBe(0);
      expect(result.courses[0].enrollments).toBe(0);
    });

    it("aggregates revenue from purchases", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
          },
        ])
        .run();

      const result = getInstructorOverview({ instructorId: base.instructor.id });
      expect(result.totalRevenue).toBe(4999);
      expect(result.courses[0].revenue).toBe(4999);
    });

    it("aggregates enrollments", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const result = getInstructorOverview({ instructorId: base.instructor.id });
      expect(result.totalEnrollments).toBe(1);
      expect(result.courses[0].enrollments).toBe(1);
    });

    it("calculates avg completion rate", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student 2",
          email: "s2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            completedAt: "2026-01-15T00:00:00.000Z",
          },
          { userId: student2.id, courseId: base.course.id },
        ])
        .run();

      const result = getInstructorOverview({ instructorId: base.instructor.id });
      expect(result.avgCompletionRate).toBe(50);
    });

    it("filters by date range", () => {
      const from = new Date("2026-02-01");
      const to = new Date("2026-02-28");

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            country: "US",
            createdAt: "2026-01-15T00:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            country: "US",
            createdAt: "2026-02-15T00:00:00.000Z",
          },
        ])
        .run();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2026-01-15T00:00:00.000Z",
          },
        ])
        .run();

      const result = getInstructorOverview({
        instructorId: base.instructor.id,
        from,
        to,
      });

      expect(result.totalRevenue).toBe(2000);
      expect(result.totalEnrollments).toBe(0);
    });

    it("includes purchase exactly on from boundary", () => {
      const from = new Date("2026-02-01");
      const to = new Date("2026-02-28");

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
          createdAt: "2026-02-01T00:00:00.000Z",
        })
        .run();

      const result = getInstructorOverview({
        instructorId: base.instructor.id,
        from,
        to,
      });
      expect(result.totalRevenue).toBe(5000);
    });

    it("includes purchase exactly on to boundary", () => {
      const from = new Date("2026-02-01");
      const to = new Date("2026-02-28");

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
          createdAt: "2026-02-28T23:59:59.999Z",
        })
        .run();

      const result = getInstructorOverview({
        instructorId: base.instructor.id,
        from,
        to,
      });
      expect(result.totalRevenue).toBe(5000);
    });

    it("isolates data per instructor (multi-course)", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Other",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9000,
            country: "US",
          },
        ])
        .run();

      const result = getInstructorOverview({
        instructorId: base.instructor.id,
      });
      expect(result.totalRevenue).toBe(3000);
      expect(result.courses).toHaveLength(1);
    });

    it("returns per-course breakdown for multi-course instructor", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Second",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 7000,
            country: "US",
          },
        ])
        .run();

      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.user.id, courseId: course2.id },
        ])
        .run();

      const result = getInstructorOverview({
        instructorId: base.instructor.id,
      });

      expect(result.totalRevenue).toBe(10000);
      expect(result.totalEnrollments).toBe(2);
      expect(result.courses).toHaveLength(2);

      const c1 = result.courses.find((c) => c.courseId === base.course.id)!;
      const c2 = result.courses.find((c) => c.courseId === course2.id)!;
      expect(c1.revenue).toBe(3000);
      expect(c2.revenue).toBe(7000);
      expect(c1.enrollments).toBe(1);
      expect(c2.enrollments).toBe(1);
    });

    it("computes avg completion across multiple courses", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Second",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      // course1: 1/1 = 100%, course2: 0/1 = 0%  => avg 50%
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            completedAt: "2026-01-15T00:00:00.000Z",
          },
          { userId: base.user.id, courseId: course2.id },
        ])
        .run();

      const result = getInstructorOverview({
        instructorId: base.instructor.id,
      });
      expect(result.avgCompletionRate).toBe(50);
    });

    it("returns 0 avg completion when no enrollments exist", () => {
      const result = getInstructorOverview({ instructorId: base.instructor.id });
      expect(result.avgCompletionRate).toBe(0);
    });

    it("returns revenue time series aggregated across courses", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Second",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            country: "US",
            createdAt: "2026-02-10T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 2000,
            country: "US",
            createdAt: "2026-02-10T15:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            country: "US",
            createdAt: "2026-02-11T10:00:00.000Z",
          },
        ])
        .run();

      const result = getInstructorOverview({ instructorId: base.instructor.id });
      expect(result.revenueTimeSeries).toHaveLength(2);
      expect(result.revenueTimeSeries[0]).toEqual({ date: "2026-02-10", value: 3000 });
      expect(result.revenueTimeSeries[1]).toEqual({ date: "2026-02-11", value: 3000 });
    });

    it("returns empty revenue time series when no purchases", () => {
      const result = getInstructorOverview({ instructorId: base.instructor.id });
      expect(result.revenueTimeSeries).toEqual([]);
    });

    it("filters revenue time series by date range", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            country: "US",
            createdAt: "2026-01-15T00:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            country: "US",
            createdAt: "2026-02-15T00:00:00.000Z",
          },
        ])
        .run();

      const result = getInstructorOverview({
        instructorId: base.instructor.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.revenueTimeSeries).toHaveLength(1);
      expect(result.revenueTimeSeries[0]).toEqual({ date: "2026-02-15", value: 2000 });
    });
  });

  // ─── getCourseRevenueSummary ───

  describe("getCourseRevenueSummary", () => {
    it("returns zero revenue and empty transactions when no purchases", () => {
      const result = getCourseRevenueSummary({ courseId: base.course.id });
      expect(result.totalRevenue).toBe(0);
      expect(result.transactions).toHaveLength(0);
    });

    it("returns total revenue and transaction details", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: "2026-02-10T12:00:00.000Z",
        })
        .run();

      const result = getCourseRevenueSummary({ courseId: base.course.id });
      expect(result.totalRevenue).toBe(4999);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        studentName: "Test User",
        studentEmail: "test@example.com",
        pricePaid: 4999,
        country: "US",
      });
    });

    it("returns time series grouped by date", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            country: "US",
            createdAt: "2026-02-10T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            country: "US",
            createdAt: "2026-02-10T15:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 3000,
            country: "GB",
            createdAt: "2026-02-11T10:00:00.000Z",
          },
        ])
        .run();

      const result = getCourseRevenueSummary({ courseId: base.course.id });
      expect(result.totalRevenue).toBe(6000);
      expect(result.timeSeries).toHaveLength(2);
      expect(result.timeSeries[0]).toEqual({ date: "2026-02-10", value: 3000 });
      expect(result.timeSeries[1]).toEqual({ date: "2026-02-11", value: 3000 });
    });

    it("filters by date range", () => {
      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 1000,
            country: "US",
            createdAt: "2026-01-15T00:00:00.000Z",
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            country: "US",
            createdAt: "2026-02-15T00:00:00.000Z",
          },
        ])
        .run();

      const result = getCourseRevenueSummary({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });

      expect(result.totalRevenue).toBe(2000);
      expect(result.transactions).toHaveLength(1);
      expect(result.timeSeries).toHaveLength(1);
    });

    it("includes purchase on from boundary", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
          createdAt: "2026-02-01T00:00:00.000Z",
        })
        .run();

      const result = getCourseRevenueSummary({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.totalRevenue).toBe(5000);
    });

    it("includes purchase on to boundary", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
          createdAt: "2026-02-28T23:59:59.999Z",
        })
        .run();

      const result = getCourseRevenueSummary({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.totalRevenue).toBe(5000);
    });
  });

  // ─── getCourseEnrollmentSummary ───

  describe("getCourseEnrollmentSummary", () => {
    it("returns zero count and empty series when no enrollments", () => {
      const result = getCourseEnrollmentSummary({ courseId: base.course.id });
      expect(result.totalEnrollments).toBe(0);
      expect(result.timeSeries).toHaveLength(0);
    });

    it("returns total count and time series", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student 2",
          email: "s2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2026-02-10T10:00:00.000Z",
          },
          {
            userId: student2.id,
            courseId: base.course.id,
            enrolledAt: "2026-02-10T15:00:00.000Z",
          },
        ])
        .run();

      const result = getCourseEnrollmentSummary({ courseId: base.course.id });
      expect(result.totalEnrollments).toBe(2);
      expect(result.timeSeries).toHaveLength(1);
      expect(result.timeSeries[0]).toEqual({ date: "2026-02-10", value: 2 });
    });

    it("filters by date range", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            enrolledAt: "2026-01-15T00:00:00.000Z",
          },
        ])
        .run();

      const result = getCourseEnrollmentSummary({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.totalEnrollments).toBe(0);
      expect(result.timeSeries).toHaveLength(0);
    });

    it("includes enrollment on from boundary", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: "2026-02-01T00:00:00.000Z",
        })
        .run();

      const result = getCourseEnrollmentSummary({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.totalEnrollments).toBe(1);
    });

    it("includes enrollment on to boundary", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: "2026-02-28T23:59:59.999Z",
        })
        .run();

      const result = getCourseEnrollmentSummary({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.totalEnrollments).toBe(1);
    });
  });

  // ─── getCourseCompletionRate ───

  describe("getCourseCompletionRate", () => {
    it("returns 0 when no enrollments", () => {
      const result = getCourseCompletionRate({ courseId: base.course.id });
      expect(result.completionRate).toBe(0);
      expect(result.totalEnrolled).toBe(0);
      expect(result.totalCompleted).toBe(0);
    });

    it("returns correct rate with partial completions", () => {
      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student 2",
          email: "s2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      const student3 = testDb
        .insert(schema.users)
        .values({
          name: "Student 3",
          email: "s3@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            completedAt: "2026-02-10T00:00:00.000Z",
            enrolledAt: "2026-02-01T00:00:00.000Z",
          },
          {
            userId: student2.id,
            courseId: base.course.id,
            enrolledAt: "2026-02-01T00:00:00.000Z",
          },
          {
            userId: student3.id,
            courseId: base.course.id,
            completedAt: "2026-02-15T00:00:00.000Z",
            enrolledAt: "2026-02-01T00:00:00.000Z",
          },
        ])
        .run();

      const result = getCourseCompletionRate({ courseId: base.course.id });
      expect(result.totalEnrolled).toBe(3);
      expect(result.totalCompleted).toBe(2);
      expect(result.completionRate).toBeCloseTo(66.67, 1);
    });

    it("returns 100 when all enrolled students completed", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          completedAt: "2026-02-10T00:00:00.000Z",
          enrolledAt: "2026-02-01T00:00:00.000Z",
        })
        .run();

      const result = getCourseCompletionRate({ courseId: base.course.id });
      expect(result.completionRate).toBe(100);
    });

    it("filters by enrolledAt date range", () => {
      testDb
        .insert(schema.enrollments)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            completedAt: "2026-01-20T00:00:00.000Z",
            enrolledAt: "2026-01-10T00:00:00.000Z",
          },
        ])
        .run();

      const result = getCourseCompletionRate({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.totalEnrolled).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    it("includes enrollment on from boundary", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          completedAt: "2026-02-10T00:00:00.000Z",
          enrolledAt: "2026-02-01T00:00:00.000Z",
        })
        .run();

      const result = getCourseCompletionRate({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      expect(result.totalEnrolled).toBe(1);
      expect(result.totalCompleted).toBe(1);
    });
  });

  // ─── getModuleQuizPassRates ───

  describe("getModuleQuizPassRates", () => {
    function seedCourseStructure() {
      const mod1 = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();
      const mod2 = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 2", position: 2 })
        .returning()
        .get();
      const lesson1 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod1.id, title: "Lesson 1", position: 1 })
        .returning()
        .get();
      const lesson2 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod2.id, title: "Lesson 2", position: 1 })
        .returning()
        .get();
      const quiz1 = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson1.id, title: "Quiz 1", passingScore: 0.7 })
        .returning()
        .get();
      const quiz2 = testDb
        .insert(schema.quizzes)
        .values({ lessonId: lesson2.id, title: "Quiz 2", passingScore: 0.7 })
        .returning()
        .get();
      return { mod1, mod2, lesson1, lesson2, quiz1, quiz2 };
    }

    it("returns empty array when no modules/quizzes exist", () => {
      const result = getModuleQuizPassRates({ courseId: base.course.id });
      expect(result).toEqual([]);
    });

    it("returns zero attempts when quizzes exist but no attempts", () => {
      const { mod1, mod2 } = seedCourseStructure();
      const result = getModuleQuizPassRates({ courseId: base.course.id });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        moduleTitle: "Module 1",
        attemptCount: 0,
        passRate: 0,
      });
      expect(result[1]).toMatchObject({
        moduleTitle: "Module 2",
        attemptCount: 0,
        passRate: 0,
      });
    });

    it("calculates pass rate using latest attempt per student per quiz", () => {
      const { quiz1 } = seedCourseStructure();

      // Student fails first, then passes — only latest counts
      testDb
        .insert(schema.quizAttempts)
        .values([
          {
            userId: base.user.id,
            quizId: quiz1.id,
            score: 0.5,
            passed: false,
            attemptedAt: "2026-02-01T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            quizId: quiz1.id,
            score: 0.9,
            passed: true,
            attemptedAt: "2026-02-01T11:00:00.000Z",
          },
        ])
        .run();

      const result = getModuleQuizPassRates({ courseId: base.course.id });
      const mod1 = result.find((r) => r.moduleTitle === "Module 1")!;
      expect(mod1.attemptCount).toBe(1); // 1 student's latest attempt
      expect(mod1.passRate).toBe(100);
    });

    it("retries don't inflate failures", () => {
      const { quiz1 } = seedCourseStructure();
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "Student 2", email: "s2@test.com", role: schema.UserRole.Student })
        .returning()
        .get();

      // Student 1: fail then pass → pass
      // Student 2: fail only → fail
      testDb
        .insert(schema.quizAttempts)
        .values([
          {
            userId: base.user.id,
            quizId: quiz1.id,
            score: 0.3,
            passed: false,
            attemptedAt: "2026-02-01T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            quizId: quiz1.id,
            score: 0.8,
            passed: true,
            attemptedAt: "2026-02-01T11:00:00.000Z",
          },
          {
            userId: student2.id,
            quizId: quiz1.id,
            score: 0.4,
            passed: false,
            attemptedAt: "2026-02-01T10:00:00.000Z",
          },
        ])
        .run();

      const result = getModuleQuizPassRates({ courseId: base.course.id });
      const mod1 = result.find((r) => r.moduleTitle === "Module 1")!;
      expect(mod1.attemptCount).toBe(2);
      expect(mod1.passRate).toBe(50);
    });

    it("filters by date range", () => {
      const { quiz1 } = seedCourseStructure();

      testDb
        .insert(schema.quizAttempts)
        .values([
          {
            userId: base.user.id,
            quizId: quiz1.id,
            score: 0.9,
            passed: true,
            attemptedAt: "2026-01-15T10:00:00.000Z",
          },
          {
            userId: base.user.id,
            quizId: quiz1.id,
            score: 0.5,
            passed: false,
            attemptedAt: "2026-02-15T10:00:00.000Z",
          },
        ])
        .run();

      const result = getModuleQuizPassRates({
        courseId: base.course.id,
        from: new Date("2026-02-01"),
        to: new Date("2026-02-28"),
      });
      const mod1 = result.find((r) => r.moduleTitle === "Module 1")!;
      // Only Feb attempt exists in range; it's the latest in range → fail
      expect(mod1.attemptCount).toBe(1);
      expect(mod1.passRate).toBe(0);
    });

    it("returns modules ordered by position", () => {
      seedCourseStructure();
      const result = getModuleQuizPassRates({ courseId: base.course.id });
      expect(result[0].moduleTitle).toBe("Module 1");
      expect(result[1].moduleTitle).toBe("Module 2");
    });
  });

  // ─── getLessonDropoff ───

  describe("getLessonDropoff", () => {
    function seedLessons() {
      const mod1 = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 1", position: 1 })
        .returning()
        .get();
      const mod2 = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 2", position: 2 })
        .returning()
        .get();
      const lesson1 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod1.id, title: "L1", position: 1 })
        .returning()
        .get();
      const lesson2 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod1.id, title: "L2", position: 2 })
        .returning()
        .get();
      const lesson3 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod2.id, title: "L3", position: 1 })
        .returning()
        .get();
      return { mod1, mod2, lesson1, lesson2, lesson3 };
    }

    it("returns empty array when no lessons exist", () => {
      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result).toEqual([]);
    });

    it("returns 100% dropoff when enrolled students have no progress", () => {
      const { lesson1, lesson2, lesson3 } = seedLessons();
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ lessonTitle: "L1", neverStartedPct: 100 });
      expect(result[1]).toMatchObject({ lessonTitle: "L2", neverStartedPct: 100 });
      expect(result[2]).toMatchObject({ lessonTitle: "L3", neverStartedPct: 100 });
    });

    it("calculates correct dropoff percentages", () => {
      const { lesson1, lesson2, lesson3 } = seedLessons();
      const student2 = testDb
        .insert(schema.users)
        .values({ name: "Student 2", email: "s2@test.com", role: schema.UserRole.Student })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: student2.id, courseId: base.course.id },
        ])
        .run();

      // Both started L1, only user started L2, nobody started L3
      testDb
        .insert(schema.lessonProgress)
        .values([
          { userId: base.user.id, lessonId: lesson1.id, status: schema.LessonProgressStatus.Completed },
          { userId: student2.id, lessonId: lesson1.id, status: schema.LessonProgressStatus.InProgress },
          { userId: base.user.id, lessonId: lesson2.id, status: schema.LessonProgressStatus.InProgress },
        ])
        .run();

      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result[0]).toMatchObject({ lessonTitle: "L1", neverStartedPct: 0 });
      expect(result[1]).toMatchObject({ lessonTitle: "L2", neverStartedPct: 50 });
      expect(result[2]).toMatchObject({ lessonTitle: "L3", neverStartedPct: 100 });
    });

    it("orders lessons by module position then lesson position", () => {
      const { mod1 } = seedLessons();
      // Add another lesson at position 0 in mod1 — should come first
      testDb
        .insert(schema.lessons)
        .values({ moduleId: mod1.id, title: "L0", position: 0 })
        .run();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();

      const result = getLessonDropoff({ courseId: base.course.id });
      expect(result[0].lessonTitle).toBe("L0");
      expect(result[1].lessonTitle).toBe("L1");
      expect(result[2].lessonTitle).toBe("L2");
      expect(result[3].lessonTitle).toBe("L3");
    });

    it("returns empty dropoff data when no enrollments", () => {
      seedLessons();
      const result = getLessonDropoff({ courseId: base.course.id });
      // Lessons exist but no enrollments → 0 enrolled, so percentages are 0
      expect(result).toHaveLength(3);
      expect(result[0].neverStartedPct).toBe(0);
    });
  });
});
