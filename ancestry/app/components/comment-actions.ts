"use server";

import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, createComment, deleteComment, logActivity } from "@/lib/db/queries";
import type { CommentTargetType } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function addCommentAction(
  targetType: CommentTargetType,
  targetId: string,
  body: string,
  parentId?: string,
) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);

  const comment = await createComment({
    treeId: tree.id,
    authorEmail: session.user.email,
    targetType,
    targetId,
    parentId,
    body,
  });

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user.email,
    action: "comment_added",
    targetType,
    targetId,
    targetName: body.slice(0, 60),
  });

  revalidatePath(`/person/${targetId}`);
  return comment;
}

export async function deleteCommentAction(commentId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  await deleteComment(commentId, session.user.email);
  revalidatePath("/");
}
