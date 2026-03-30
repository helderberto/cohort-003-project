import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let lesson2Id: number;
let mod2Id: number;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    const mod = testDb
      .insert(schema.modules)
      .values({ courseId: base.course.id, title: "Module 1", position: 1 })
      .returning()
      .get();

    const lesson = testDb
      .insert(schema.lessons)
      .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
      .returning()
      .get();

    lessonId = lesson.id;

    const mod2 = testDb
      .insert(schema.modules)
      .values({ courseId: base.course.id, title: "Module 2", position: 2 })
      .returning()
      .get();

    mod2Id = mod2.id;

    const lesson2 = testDb
      .insert(schema.lessons)
      .values({ moduleId: mod2.id, title: "Lesson 2", position: 1 })
      .returning()
      .get();

    lesson2Id = lesson2.id;
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists", () => {
      const result = toggleBookmark({ userId: base.user.id, lessonId });
      expect(result.bookmarked).toBe(true);
    });

    it("removes a bookmark when one already exists", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      const result = toggleBookmark({ userId: base.user.id, lessonId });
      expect(result.bookmarked).toBe(false);
    });

    it("toggling twice results in bookmarked state again", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId });
      const result = toggleBookmark({ userId: base.user.id, lessonId });
      expect(result.bookmarked).toBe(true);
    });

    it("bookmarks are independent per user", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      const result = toggleBookmark({ userId: base.instructor.id, lessonId });
      expect(result.bookmarked).toBe(true);
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns false when lesson is not bookmarked", () => {
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(false);
    });

    it("returns true after bookmarking", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(true);
    });

    it("returns false after unbookmarking", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId });
      expect(isLessonBookmarked({ userId: base.user.id, lessonId })).toBe(false);
    });

    it("is isolated per user", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      expect(isLessonBookmarked({ userId: base.instructor.id, lessonId })).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns empty array when no bookmarks exist", () => {
      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(0);
    });

    it("returns bookmarked lesson ids for the course", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toContain(lessonId);
    });

    it("returns ids from multiple modules", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId: lesson2Id });
      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(2);
      expect(ids).toContain(lessonId);
      expect(ids).toContain(lesson2Id);
    });

    it("does not return bookmarks from other users", () => {
      toggleBookmark({ userId: base.instructor.id, lessonId });
      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(0);
    });

    it("does not return removed bookmarks", () => {
      toggleBookmark({ userId: base.user.id, lessonId });
      toggleBookmark({ userId: base.user.id, lessonId });
      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(0);
    });

    it("does not return lessons from other courses", () => {
      const otherCategory = testDb
        .insert(schema.categories)
        .values({ name: "Other", slug: "other" })
        .returning()
        .get();

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "desc",
          instructorId: base.instructor.id,
          categoryId: otherCategory.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      const otherMod = testDb
        .insert(schema.modules)
        .values({ courseId: otherCourse.id, title: "Mod", position: 1 })
        .returning()
        .get();

      const otherLesson = testDb
        .insert(schema.lessons)
        .values({ moduleId: otherMod.id, title: "L", position: 1 })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: otherLesson.id });

      const ids = getBookmarkedLessonIds({ userId: base.user.id, courseId: base.course.id });
      expect(ids).toHaveLength(0);
    });
  });
});
