/**
 * Inngest client — shared across all port background job functions.
 *
 * Event key and signing key are read from env at runtime.
 * In development (no keys set) Inngest operates in "dev server" mode.
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "wv-port" });

// ── event type definitions ────────────────────────────────

export type RfpPursuingTriggeredEvent = {
  name: "rfp/pursuing.triggered";
  data: {
    rfpId: string;
    triggeredBy: string; // email of the user who made the status change
  };
};

export type TimesheetStatusChangedEvent = {
  name: "timesheet/status.changed";
  data: {
    timesheetId: string;
    newStatus: string;
    previousStatus?: string;
    approverEmail: string; // email of the user who made the status change
  };
};

export type Events = {
  "rfp/pursuing.triggered": RfpPursuingTriggeredEvent;
  "timesheet/status.changed": TimesheetStatusChangedEvent;
};
