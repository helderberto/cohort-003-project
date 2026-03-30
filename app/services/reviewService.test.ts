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
  upsertReview,
  getReviewByUserAndCourse,
  getAverageRating,
  getAverageRatings,
} from "./reviewService";

describe("reviewService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("upsertReview", () => {
    it("creates a new review", () => {
      const review = upsertReview(base.user.id, base.course.id, 4);

      expect(review).toBeDefined();
      expect(review.userId).toBe(base.user.id);
      expect(review.courseId).toBe(base.course.id);
      expect(review.rating).toBe(4);
    });

    it("updates existing review for same user+course", () => {
      upsertReview(base.user.id, base.course.id, 3);
      const updated = upsertReview(base.user.id, base.course.id, 5);

      expect(updated.rating).toBe(5);

      // Should still be only one review
      const all = testDb
        .select()
        .from(schema.courseReviews)
        .all();
      expect(all).toHaveLength(1);
    });
  });

  describe("getReviewByUserAndCourse", () => {
    it("returns null when no review exists", () => {
      const review = getReviewByUserAndCourse(base.user.id, base.course.id);
      expect(review).toBeUndefined();
    });

    it("returns the review when it exists", () => {
      upsertReview(base.user.id, base.course.id, 4);
      const review = getReviewByUserAndCourse(base.user.id, base.course.id);

      expect(review).toBeDefined();
      expect(review!.rating).toBe(4);
    });
  });

  describe("getAverageRating", () => {
    it("returns null when no reviews exist", () => {
      const result = getAverageRating(base.course.id);
      expect(result).toBeNull();
    });

    it("returns correct average for single review", () => {
      upsertReview(base.user.id, base.course.id, 4);
      const result = getAverageRating(base.course.id);

      expect(result).toEqual({ average: 4, count: 1 });
    });

    it("returns correct average for multiple reviews", () => {
      upsertReview(base.user.id, base.course.id, 4);
      upsertReview(base.instructor.id, base.course.id, 2);

      const result = getAverageRating(base.course.id);

      expect(result).toEqual({ average: 3, count: 2 });
    });
  });

  describe("getAverageRatings", () => {
    it("returns empty map for empty courseIds", () => {
      const result = getAverageRatings([]);
      expect(result.size).toBe(0);
    });

    it("returns empty map when no reviews exist", () => {
      const result = getAverageRatings([base.course.id]);
      expect(result.size).toBe(0);
    });

    it("returns averages for multiple courses", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Course 2",
          slug: "course-2",
          description: "Second course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      upsertReview(base.user.id, base.course.id, 5);
      upsertReview(base.instructor.id, base.course.id, 3);
      upsertReview(base.user.id, course2.id, 2);

      const result = getAverageRatings([base.course.id, course2.id]);

      expect(result.get(base.course.id)).toEqual({ average: 4, count: 2 });
      expect(result.get(course2.id)).toEqual({ average: 2, count: 1 });
    });
  });
});
