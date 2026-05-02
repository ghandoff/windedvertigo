"use server";

import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getPerson, getPersonMedia, deleteMedia, setPersonThumbnail, logActivity } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";
import { deleteMediaByUrl } from "@/lib/storage";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export async function getPersonMediaAction(personId: string): Promise<MediaItem[]> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(personId);
  if (!person || person.tree_id !== tree.id) throw new Error("person not found");

  const rows = await getPersonMedia(personId);
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  }));
}

export async function deleteMediaAction(mediaId: string, personId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(personId);
  if (!person || person.tree_id !== tree.id) throw new Error("person not found");

  const mediaUrl = await deleteMedia(mediaId);
  if (mediaUrl) {
    await deleteMediaByUrl(mediaUrl); // silently ignores errors internally
  }

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user.email!,
    action: "media_deleted",
    targetType: "person",
    targetId: personId,
    targetName: mediaId,
  });

  revalidatePath(`/person/${personId}`);
}

export async function setThumbnailAction(personId: string, url: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(personId);
  if (!person || person.tree_id !== tree.id) throw new Error("person not found");

  await setPersonThumbnail(personId, url);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user.email!,
    action: "thumbnail_set",
    targetType: "person",
    targetId: personId,
    targetName: url,
  });

  revalidatePath(`/person/${personId}`);
  revalidatePath("/");
}
