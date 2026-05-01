import Anthropic from "@anthropic-ai/sdk";

export type GeneratedArtefact = {
  title: string;
  content: string;
};

const SYSTEM_PROMPT = `you are a concise curriculum-design assistant. when given a learning outcome and project description, you produce a short fictional student artefact (a project submission excerpt) that illustrates what decent-but-not-perfect work looks like. the artefact is used during peer calibration so students can practise applying the rubric before scoring real work.

format your response exactly like this:
TITLE: <a short descriptive title for the artefact>
CONTENT: <3-5 short paragraphs of the fictional student work>

rules:
- keep the total response under 400 words
- the artefact should feel like authentic student work — some strengths, some gaps
- match the subject area implied by the learning outcome and project
- use lowercase throughout except for proper nouns and acronyms
- no meta-commentary, no preamble, just the TITLE: and CONTENT: lines`;

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function generateArtefact(
  outcome: string,
  project: string,
): Promise<GeneratedArtefact | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `learning outcome: ${outcome}\n\nproject description: ${project}`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  const titleMatch = raw.match(/^TITLE:\s*(.+)/m);
  const contentMatch = raw.match(/^CONTENT:\s*([\s\S]+)/m);

  if (!titleMatch || !contentMatch) return null;

  return {
    title: titleMatch[1].trim(),
    content: contentMatch[1].trim(),
  };
}
