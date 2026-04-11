import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, updatePersonThumbnail } from "@/lib/db/queries";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tree = await getOrCreateTree(session.user.email);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const personId = formData.get("personId") as string | null;

  if (!file || !personId) {
    return NextResponse.json({ error: "file and personId required" }, { status: 400 });
  }

  // validate it's an image
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "only images are supported" }, { status: 400 });
  }

  // max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (max 10mb)" }, { status: 400 });
  }

  // verify person belongs to this tree
  const sql = getDb();
  const person = await sql`
    SELECT id, thumbnail_url FROM persons
    WHERE id = ${personId} AND tree_id = ${tree.id}
  `;
  if (person.length === 0) {
    return NextResponse.json({ error: "person not found" }, { status: 404 });
  }

  // upload to vercel blob
  const filename = `ancestry/${tree.id}/${personId}/${Date.now()}-${file.name}`;
  const blob = await put(filename, file, { access: "public" });

  // create media record
  const media = await sql`
    INSERT INTO media (tree_id, media_type, url, filename, mime_type, size_bytes)
    VALUES (${tree.id}, 'photo', ${blob.url}, ${file.name}, ${file.type}, ${file.size})
    RETURNING id
  `;
  const mediaId = media[0].id;

  // link media to person
  await sql`
    INSERT INTO media_links (media_id, person_id)
    VALUES (${mediaId}, ${personId})
  `;

  // auto-set thumbnail if person doesn't have one
  if (!person[0].thumbnail_url) {
    await updatePersonThumbnail(personId, blob.url);
  }

  return NextResponse.json({ id: mediaId, url: blob.url });
}
