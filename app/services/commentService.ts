import { eq, asc, and } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users } from "~/db/schema";

export function getCommentsForLesson(lessonId: number, includeHidden: boolean) {
  const baseQuery = db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      body: lessonComments.body,
      hidden: lessonComments.hidden,
      createdAt: lessonComments.createdAt,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .orderBy(asc(lessonComments.createdAt));

  if (includeHidden) {
    return baseQuery.where(eq(lessonComments.lessonId, lessonId)).all();
  }

  return baseQuery
    .where(
      and(eq(lessonComments.lessonId, lessonId), eq(lessonComments.hidden, false)),
    )
    .all();
}

export function createComment({
  lessonId,
  userId,
  body,
}: {
  lessonId: number;
  userId: number;
  body: string;
}) {
  return db
    .insert(lessonComments)
    .values({ lessonId, userId, body })
    .returning()
    .get();
}

export function getCommentById(commentId: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .get();
}

export function deleteComment(commentId: number) {
  db.delete(lessonComments).where(eq(lessonComments.id, commentId)).run();
}

export function editComment(commentId: number, body: string) {
  return db
    .update(lessonComments)
    .set({ body })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function setCommentVisibility(commentId: number, hidden: boolean) {
  return db
    .update(lessonComments)
    .set({ hidden })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}
