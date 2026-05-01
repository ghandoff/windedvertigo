/**
 * OpenAI Whisper wrapper.
 *
 * Returns { transcript, error }. If OPENAI_API_KEY is missing, or the
 * call fails, we return a soft error rather than throwing — the
 * transcribe pipeline still creates the Notion page with the audio
 * link so the work isn't lost.
 */

interface TranscribeResult {
  transcript: string;
  error?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export async function transcribeAudio(
  audio: Buffer,
  contentType: string,
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      transcript: "",
      error: "OPENAI_API_KEY not set on the port project",
    };
  }

  try {
    // OpenAI's audio API expects a multipart upload. node fetch handles
    // FormData with Blob natively on Node 20+.
    const form = new FormData();
    const ext = contentType.includes("mp4")
      ? "m4a"
      : contentType.includes("mpeg")
        ? "mp3"
        : "webm";
    const blob = new Blob([new Uint8Array(audio)], { type: contentType });
    form.append("file", blob, `meeting.${ext}`);
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        transcript: "",
        error: `whisper returned ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      text?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    return {
      transcript: (data.text ?? "").trim(),
      segments: data.segments,
    };
  } catch (err) {
    return {
      transcript: "",
      error: err instanceof Error ? err.message : "unknown whisper error",
    };
  }
}
