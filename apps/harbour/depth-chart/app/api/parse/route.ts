import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PARSE_OBJECTIVES_SYSTEM, build_parse_prompt } from "@/lib/prompts/parse-objectives";
import type { ParseObjectivesInput } from "@/lib/prompts/parse-objectives";
import { extract_text } from "@/lib/extractors";
import { auth } from "@/lib/auth";
import { track_event } from "@/lib/queries";

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    const content_type = request.headers.get("content-type") || "";
    let raw_text: string;
    let subject = "";
    let grade_level = "";
    let frameworks: { webb_dok: boolean; solo: boolean } | undefined;

    if (content_type.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") as File | null;
      subject = (form.get("subject") as string) || "";
      grade_level = (form.get("grade_level") as string) || "";
      const fw_raw = form.get("frameworks") as string | null;
      if (fw_raw) {
        try { frameworks = JSON.parse(fw_raw); } catch {}
      }

      if (!file) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }

      raw_text = await extract_text(file);

      if (!raw_text.trim()) {
        return NextResponse.json(
          { error: "could not extract text from file. try pasting the text directly." },
          { status: 400 }
        );
      }
    } else {
      const body = (await request.json()) as ParseObjectivesInput;
      if (!body.raw_text?.trim()) {
        return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
      }
      raw_text = body.raw_text;
      subject = body.subject || "";
      grade_level = body.grade_level || "";
      frameworks = body.frameworks;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: PARSE_OBJECTIVES_SYSTEM,
      messages: [{ role: "user", content: build_parse_prompt({ raw_text, subject, grade_level, frameworks }) }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // extract JSON from response (may be wrapped in markdown code block)
    const json_match = text.match(/\[[\s\S]*\]/);
    if (!json_match) {
      return NextResponse.json(
        { error: "failed to parse objectives from response" },
        { status: 500 }
      );
    }

    const objectives = JSON.parse(json_match[0]);

    // track parse event (non-blocking)
    const session = await auth();
    const user_id = session?.user?.id ?? null;
    track_event(user_id, "plan_parsed", {
      objectives_count: objectives.length,
      blooms_levels: objectives.map((o: { blooms_level: string }) => o.blooms_level),
      source_format: content_type.includes("multipart") ? "file" : "text",
    }).catch(() => {});

    return NextResponse.json({ objectives, extracted_text: raw_text });
  } catch (error) {
    console.error("[parse] error:", error);
    return NextResponse.json(
      { error: "failed to parse lesson plan" },
      { status: 500 }
    );
  }
}
