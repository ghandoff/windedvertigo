import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFY_BLOOMS_SYSTEM, build_classify_prompt } from "@/lib/prompts/classify-blooms";
import type { ClassifyInput } from "@/lib/prompts/classify-blooms";

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClassifyInput;

    if (!body.objective_text?.trim()) {
      return NextResponse.json(
        { error: "objective_text is required" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: CLASSIFY_BLOOMS_SYSTEM,
      messages: [{ role: "user", content: build_classify_prompt(body) }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const json_match = text.match(/\{[\s\S]*\}/);
    if (!json_match) {
      return NextResponse.json(
        { error: "failed to parse classification" },
        { status: 500 }
      );
    }

    const classification = JSON.parse(json_match[0]);

    return NextResponse.json(classification);
  } catch (error) {
    console.error("[classify] error:", error);
    return NextResponse.json(
      { error: "failed to classify objective" },
      { status: 500 }
    );
  }
}
