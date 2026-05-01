/**
 * AI task generation — feed a project brief or RFP to Claude,
 * get back structured work items with estimates and dependencies.
 */

import { callClaude, parseJsonResponse } from "./client";

export interface GeneratedTask {
  title: string;
  type: "plan" | "design" | "research" | "implement" | "publish/present" | "adapt" | "review" | "admin" | "coordinate";
  estimateHours: number;
  priority: "low" | "medium" | "high" | "urgent";
  dependencies: string[]; // titles of other tasks this depends on
  description: string;
}

interface TaskGenerationResult {
  tasks: GeneratedTask[];
  summary: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

const SYSTEM_PROMPT = `You are a project management assistant for winded.vertigo, a learning design collective.
Given a project brief, RFP description, or scope of work, generate a structured list of work items (tasks).

For each task, provide:
- title: concise task name (lowercase)
- type: one of: plan, design, research, implement, publish/present, adapt, review, admin, coordinate
- estimateHours: realistic estimate in hours (0.5 to 40)
- priority: low, medium, high, or urgent
- dependencies: array of other task titles this depends on (empty if none)
- description: 1-2 sentence description of what this involves

Also provide a brief summary of the overall decomposition.

Output ONLY valid JSON with this structure:
{
  "tasks": [...],
  "summary": "..."
}

Guidelines:
- Break work into 2-8 hour chunks where possible
- Include review/QA tasks
- Include coordination tasks for multi-person work
- Be specific to learning design, ed-tech, and consulting contexts
- Order tasks roughly by execution sequence`;

export async function generateTasksFromBrief(
  brief: string,
  projectName: string,
  userId: string,
): Promise<TaskGenerationResult> {
  const result = await callClaude({
    feature: "task-generation",
    system: SYSTEM_PROMPT,
    userMessage: `Project: ${projectName}\n\nBrief:\n${brief}`,
    userId,
    maxTokens: 2048,
    temperature: 0.3,
  });

  const parsed = parseJsonResponse<{ tasks: GeneratedTask[]; summary: string }>(result.text);

  return {
    tasks: parsed.tasks,
    summary: parsed.summary,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };
}
