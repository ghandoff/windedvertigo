import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  EVALUATE_AUTHENTICITY_SYSTEM,
  build_evaluate_prompt,
} from "@/lib/prompts/evaluate-authenticity";
import { passes_authenticity_gate } from "@/lib/authenticity";
import type { EvaluateAuthenticityInput } from "@/lib/prompts/evaluate-authenticity";

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateAuthenticityInput;

    if (!body.task_prompt?.trim()) {
      return NextResponse.json(
        { error: "task_prompt is required" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: EVALUATE_AUTHENTICITY_SYSTEM,
      messages: [{ role: "user", content: build_evaluate_prompt(body) }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const json_match = text.match(/\{[\s\S]*\}/);
    if (!json_match) {
      return NextResponse.json(
        { error: "failed to parse evaluation" },
        { status: 500 }
      );
    }

    const evaluation = JSON.parse(json_match[0]);

    // override the model's pass/fail with our own threshold logic
    evaluation.passes = passes_authenticity_gate(evaluation.scores);

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("[evaluate] error:", error);
    return NextResponse.json(
      { error: "failed to evaluate task authenticity" },
      { status: 500 }
    );
  }
}
