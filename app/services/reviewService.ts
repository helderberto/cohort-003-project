import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseReviews } from "~/db/schema";

export function upsertReview(userId: number, courseId: number, rating: number) {
  const existing = db
    .select()
    .from(courseReviews)
    .where(
      and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId),
      ),
    )
    .get();

  if (existing) {
    return db
      .update(courseReviews)
      .set({ rating })
      .where(eq(courseReviews.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseReviews)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

export function getReviewByUserAndCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(courseReviews)
    .where(
      and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId),
      ),
    )
    .get();
}

export function getAverageRating(courseId: number) {
  const result = db
    .select({
      average: sql<number>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  if (!result || result.count === 0) return null;

  return { average: result.average, count: result.count };
}

export function getAverageRatings(courseIds: number[]) {
  const map = new Map<number, { average: number; count: number }>();
  if (courseIds.length === 0) return map;

  const results = db
    .select({
      courseId: courseReviews.courseId,
      average: sql<number>`avg(${courseReviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseReviews)
    .where(inArray(courseReviews.courseId, courseIds))
    .groupBy(courseReviews.courseId)
    .all();

  for (const row of results) {
    map.set(row.courseId, { average: row.average, count: row.count });
  }

  return map;
}
