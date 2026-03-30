import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createComment,
  editComment,
  getCommentsForLesson,
  getCommentById,
  setCommentVisibility,
  deleteComment,
} from "./commentService";

describe("commentService", () => {
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
  });

  describe("createComment", () => {
    it("creates a visible comment by default", () => {
      const comment = createComment({ lessonId, userId: base.user.id, body: "Hello!" });
      expect(comment.hidden).toBe(false);
    });

    it("returns the new comment with correct fields", () => {
      const comment = createComment({ lessonId, userId: base.user.id, body: "Test body" });
      expect(comment.lessonId).toBe(lessonId);
      expect(comment.userId).toBe(base.user.id);
      expect(comment.body).toBe("Test body");
      expect(comment.createdAt).toBeDefined();
    });
  });

  describe("getCommentsForLesson", () => {
    it("returns empty array when no comments exist", () => {
      const comments = getCommentsForLesson(lessonId, false);
      expect(comments).toHaveLength(0);
    });

    it("returns only visible comments when includeHidden is false", () => {
      createComment({ lessonId, userId: base.user.id, body: "Visible" });
      const hidden = createComment({ lessonId, userId: base.user.id, body: "Hidden" });
      setCommentVisibility(hidden.id, true);

      const comments = getCommentsForLesson(lessonId, false);
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe("Visible");
    });

    it("returns all comments including hidden when includeHidden is true", () => {
      createComment({ lessonId, userId: base.user.id, body: "Visible" });
      const hidden = createComment({ lessonId, userId: base.user.id, body: "Hidden" });
      setCommentVisibility(hidden.id, true);

      const comments = getCommentsForLesson(lessonId, true);
      expect(comments).toHaveLength(2);
    });

    it("returns comments with joined author name and avatarUrl", () => {
      createComment({ lessonId, userId: base.user.id, body: "Hello" });
      const comments = getCommentsForLesson(lessonId, false);
      expect(comments[0].userName).toBe(base.user.name);
      expect("userAvatarUrl" in comments[0]).toBe(true);
    });

    it("returns comments ordered by createdAt ascending", () => {
      const c1 = createComment({ lessonId, userId: base.user.id, body: "First" });
      const c2 = createComment({ lessonId, userId: base.user.id, body: "Second" });

      const comments = getCommentsForLesson(lessonId, false);
      expect(comments[0].id).toBe(c1.id);
      expect(comments[1].id).toBe(c2.id);
    });
  });

  describe("getCommentById", () => {
    it("returns undefined for non-existent id", () => {
      expect(getCommentById(9999)).toBeUndefined();
    });

    it("returns the comment when it exists", () => {
      const created = createComment({ lessonId, userId: base.user.id, body: "Test" });
      const found = getCommentById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });
  });

  describe("editComment", () => {
    it("updates the body of the comment", () => {
      const comment = createComment({ lessonId, userId: base.user.id, body: "Original" });
      const updated = editComment(comment.id, "Updated body");
      expect(updated.body).toBe("Updated body");
    });

    it("does not change other fields", () => {
      const comment = createComment({ lessonId, userId: base.user.id, body: "Original" });
      const updated = editComment(comment.id, "New body");
      expect(updated.userId).toBe(comment.userId);
      expect(updated.lessonId).toBe(comment.lessonId);
    });
  });

  describe("setCommentVisibility", () => {
    it("hides a visible comment", () => {
      const comment = createComment({ lessonId, userId: base.user.id, body: "Test" });
      const updated = setCommentVisibility(comment.id, true);
      expect(updated.hidden).toBe(true);
    });

    it("shows a hidden comment", () => {
      const comment = createComment({ lessonId, userId: base.user.id, body: "Test" });
      setCommentVisibility(comment.id, true);
      const updated = setCommentVisibility(comment.id, false);
      expect(updated.hidden).toBe(false);
    });
  });

  describe("deleteComment", () => {
    it("removes the comment from the database", () => {
      const comment = createComment({ lessonId, userId: base.user.id, body: "To delete" });
      deleteComment(comment.id);
      expect(getCommentById(comment.id)).toBeUndefined();
    });

    it("has no effect on other comments", () => {
      const keep = createComment({ lessonId, userId: base.user.id, body: "Keep" });
      const del = createComment({ lessonId, userId: base.user.id, body: "Delete" });
      deleteComment(del.id);

      const comments = getCommentsForLesson(lessonId, false);
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(keep.id);
    });
  });
});
