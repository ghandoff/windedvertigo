"use client";

import type { Activity, Participant } from "@/lib/types";
import { PollActivity } from "./activities/poll";
import { PredictionActivity } from "./activities/prediction";
import { ReflectionActivity } from "./activities/reflection";
import { OpenResponseActivity } from "./activities/open-response";
import { PuzzleActivity } from "./activities/puzzle";
import { AsymmetricActivity } from "./activities/asymmetric";
import { CanvasActivity } from "./activities/canvas";
import { SortingActivity } from "./activities/sorting";
import { RuleSandboxActivity } from "./activities/rule-sandbox";

interface Props {
  activity: Activity;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
  participantIndex?: number;
}

export function ActivityRenderer({
  activity,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
  participantIndex,
}: Props) {
  const { config } = activity;

  switch (config.type) {
    case "poll":
      return (
        <PollActivity
          config={config.poll}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    case "prediction":
      return (
        <PredictionActivity
          config={config.prediction}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    case "reflection":
      return (
        <ReflectionActivity
          config={config.reflection}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    case "open-response":
      return (
        <OpenResponseActivity
          config={config.openResponse}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    case "puzzle":
      return (
        <PuzzleActivity
          config={config.puzzle}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    case "asymmetric":
      return (
        <AsymmetricActivity
          config={config.asymmetric}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
          participantIndex={participantIndex}
        />
      );

    case "canvas":
      return (
        <CanvasActivity
          config={config.canvas}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    case "sorting":
      return (
        <SortingActivity
          config={config.sorting}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    case "rule-sandbox":
      return (
        <RuleSandboxActivity
          config={config.ruleSandbox}
          role={role}
          onSubmit={onSubmit}
          responses={responses}
          participants={participants}
          submitted={submitted}
        />
      );

    default:
      return (
        <div className="text-center py-8 text-[var(--rh-text-muted)]">
          <p>activity type not yet supported</p>
        </div>
      );
  }
}
