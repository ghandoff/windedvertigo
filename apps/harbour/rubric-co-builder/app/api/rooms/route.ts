import { NextResponse, after } from "next/server";
import { getStore } from "@/lib/store";
import { generateRoomCode } from "@/lib/room-code";
import { SEED_CRITERIA } from "@/lib/types";
import { generateArtefact } from "@/lib/generate-artefact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SeedInput = {
  name: string;
  good_description?: string;
  required?: boolean;
};

type CreateRoomInput = {
  learning_outcome: string;
  project_description: string;
  seeds?: SeedInput[];
};

function sanitise(input: unknown): CreateRoomInput | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const outcome = typeof o.learning_outcome === "string" ? o.learning_outcome.trim() : "";
  const description =
    typeof o.project_description === "string" ? o.project_description.trim() : "";
  if (!outcome || !description) return null;
  if (outcome.length > 1000 || description.length > 1000) return null;

  const rawSeeds = Array.isArray(o.seeds) ? o.seeds : [];
  const seeds: SeedInput[] = [];
  for (const s of rawSeeds) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name || name.length > 120) continue;
    seeds.push({
      name,
      good_description:
        typeof r.good_description === "string" ? r.good_description.trim().slice(0, 500) : "",
      required: r.required === true,
    });
    if (seeds.length >= 8) break;
  }
  return { learning_outcome: outcome, project_description: description, seeds };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const data = sanitise(body);
  if (!data) {
    return NextResponse.json(
      { error: "learning outcome and project description are required" },
      { status: 400 },
    );
  }

  const store = getStore();
  const count = await store.getRoomCount();
  if (count >= 300) {
    return NextResponse.json({ error: "too many rooms" }, { status: 429 });
  }
  let room: Awaited<ReturnType<typeof store.createRoom>> | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode();
    try {
      room = await store.createRoom({
        code,
        learning_outcome: data.learning_outcome,
        project_description: data.project_description,
      });
      break;
    } catch (e: unknown) {
      if (isUniqueViolation(e)) continue;
      throw e;
    }
  }
  if (!room) throw new Error("could not generate unique room code");
  const createdRoom = room;

  const seeds: SeedInput[] = data.seeds?.length
    ? data.seeds
    : SEED_CRITERIA.map((s) => ({
        name: s.name,
        good_description: s.good_description ?? "",
        required: false,
      }));

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    await store.createCriterion({
      room_id: createdRoom.id,
      name: s.name,
      good_description: s.good_description ?? null,
      source: "seed",
      required: s.required === true,
      position: i,
    });
  }

  // fire-and-forget: generate a sample artefact in the background so the
  // calibrate step can show something tailored to the teacher's brief.
  // after() keeps the connection alive past the response without blocking it.
  after(async () => {
    try {
      const generated = await generateArtefact(data.learning_outcome, data.project_description);
      if (generated) {
        await store.setSampleArtefact(createdRoom.code, generated.title, generated.content);
      }
    } catch {
      // non-fatal — calibrate step falls back to the stock sample artefact
    }
  });

  return NextResponse.json({ code: createdRoom.code, host_token: createdRoom.host_token }, { status: 201 });
}
