export type FeedbackType = "bug" | "confusing" | "idea" | "other";

export interface FeedbackPayload {
  app_slug: string;
  route: string;
  feedback_type: FeedbackType;
  severity: number; // 1–5
  comment: string | null;
  device_info: {
    ua: string;
    viewport: string;
    platform: string;
  };
  user_id?: string | null;
  user_email?: string | null;
}
