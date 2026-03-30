import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { lessonBookmarks, lessons, modules } from "~/db/schema";

export function toggleBookmark({
  userId,
  lessonId,
}: {
  userId: number;
  lessonId: number;
}) {
  const existing = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId),
      ),
    )
    .get();

  if (existing) {
    db.delete(lessonBookmarks).where(eq(lessonBookmarks.id, existing.id)).run();
    return { bookmarked: false };
  }

  db.insert(lessonBookmarks).values({ userId, lessonId }).run();
  return { bookmarked: true };
}

export function isLessonBookmarked({
  userId,
  lessonId,
}: {
  userId: number;
  lessonId: number;
}) {
  const result = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId),
      ),
    )
    .get();
  return !!result;
}

export function getBookmarkedLessonIds({
  userId,
  courseId,
}: {
  userId: number;
  courseId: number;
}) {
  const results = db
    .select({ lessonId: lessonBookmarks.lessonId })
    .from(lessonBookmarks)
    .innerJoin(lessons, eq(lessonBookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(modules.courseId, courseId),
      ),
    )
    .all();

  return results.map((r) => r.lessonId);
}
