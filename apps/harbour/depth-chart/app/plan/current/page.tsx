"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ObjectiveCard } from "@/components/objective-card";
import { TaskCard } from "@/components/task-card";
import { AlignmentReport } from "@/components/alignment-report";
import { RubricTable } from "@/components/rubric-table";
import { EJScaffoldPanel } from "@/components/ej-scaffold-panel";
import { TeacherConfigPanel } from "@/components/teacher-config-panel";
import { ExportMenu, type ExportOption } from "@/components/export-menu";
import { get_valid_formats } from "@/lib/blooms";
import { get_formats_for_level } from "@/lib/task-formats";
import { download_task_pdf } from "@/lib/download-pdf";
import {
  download_qti_package,
  download_qti_plan,
  download_rubric_csv,
  download_plan_rubrics_csv,
} from "@/lib/lms-export";
import { BLOOMS_ORDER } from "@/lib/blooms";
import { DOK_ORDER } from "@/lib/webb";
import { SOLO_ORDER } from "@/lib/solo";
import harbour_rules from "@/data/harbour-recommendations.json";
import type {
  LearningObjective,
  GeneratedTask,
  AlignmentReport as AlignmentReportType,
  BloomsLevel,
  WebbDOKLevel,
  SOLOLevel,
  TeacherConfig,
  HarbourRecommendation,
} from "@/lib/types";

interface StoredPlan {
  title: string;
  subject: string;
  grade_level: string;
  raw_text: string;
  objectives: LearningObjective[];
}

const DEFAULT_CONFIG: TeacherConfig = {
  authenticity_weights: {},
  max_minutes: 45,
  collaboration_mode: "individual",
  preferred_formats: [],
  frameworks: { webb_dok: false, solo: false },
};

function compute_harbour_recommendations(
  objectives: LearningObjective[],
  subject: string,
): HarbourRecommendation[] {
  const total = objectives.length;
  if (total === 0) return [];

  const distribution: Record<BloomsLevel, number> = {
    remember: 0, understand: 0, apply: 0, analyse: 0, evaluate: 0, create: 0,
  };
  for (const obj of objectives) distribution[obj.blooms_level]++;

  const gaps = BLOOMS_ORDER.filter((level) => (distribution[level] || 0) / total < 0.1);
  if (gaps.length === 0) return [];

  const rules = harbour_rules as HarbourRecommendation[];
  return rules
    .filter((r) =>
      r.blooms_levels.some((l) => gaps.includes(l as BloomsLevel)) &&
      (r.subject_tags.length === 0 || r.subject_tags.some((t) => subject.toLowerCase().includes(t)))
    )
    .slice(0, 5);
}

function build_alignment_report(objectives: LearningObjective[], subject: string): AlignmentReportType {
  const distribution: Record<BloomsLevel, number> = {
    remember: 0, understand: 0, apply: 0, analyse: 0, evaluate: 0, create: 0,
  };
  for (const obj of objectives) distribution[obj.blooms_level]++;

  const hocs_count = distribution.analyse + distribution.evaluate + distribution.create;
  const total = objectives.length;

  const has_dok = objectives.some((o) => o.webb_dok);
  const has_solo = objectives.some((o) => o.solo_level);

  let webb_distribution: Record<WebbDOKLevel, number> | undefined;
  if (has_dok) {
    webb_distribution = { "1": 0, "2": 0, "3": 0, "4": 0 };
    for (const obj of objectives) {
      if (obj.webb_dok) webb_distribution[obj.webb_dok]++;
    }
  }

  let solo_distribution: Record<SOLOLevel, number> | undefined;
  if (has_solo) {
    solo_distribution = { pre_structural: 0, uni_structural: 0, multi_structural: 0, relational: 0, extended_abstract: 0 };
    for (const obj of objectives) {
      if (obj.solo_level) solo_distribution[obj.solo_level]++;
    }
  }

  return {
    objectives_count: total,
    covered_count: total,
    gaps: [],
    blooms_distribution: distribution,
    hocs_percentage: total > 0 ? (hocs_count / total) * 100 : 0,
    webb_distribution,
    solo_distribution,
    harbour_recommendations: compute_harbour_recommendations(objectives, subject),
  };
}

export default function PlanPage() {
  const [plan, set_plan] = useState<StoredPlan | null>(null);
  const [tasks, set_tasks] = useState<Record<string, GeneratedTask>>({});
  const [generating, set_generating] = useState<string | null>(null);
  const [selected_task, set_selected_task] = useState<GeneratedTask | null>(null);
  const [view, set_view] = useState<"rubric" | "scaffold" | null>(null);
  const [config, set_config] = useState<TeacherConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const stored_plan = localStorage.getItem("depth_chart_plan");
    if (stored_plan) {
      set_plan(JSON.parse(stored_plan));
    }
    const stored_tasks = localStorage.getItem("depth_chart_tasks");
    if (stored_tasks) {
      set_tasks(JSON.parse(stored_tasks));
    }
    const stored_config = localStorage.getItem("depth_chart_config");
    if (stored_config) {
      set_config(JSON.parse(stored_config));
    }
  }, []);

  const update_config = useCallback((next: TeacherConfig) => {
    set_config(next);
    localStorage.setItem("depth_chart_config", JSON.stringify(next));
  }, []);

  const generate_task = useCallback(
    async (objective: LearningObjective) => {
      if (!plan) return;
      set_generating(objective.id);

      try {
        const valid = get_valid_formats(objective.blooms_level);
        const preferred = config.preferred_formats.filter((f) => valid.includes(f));
        const collab_only = config.collaboration_mode !== "individual";
        const collab_valid = collab_only
          ? get_formats_for_level(objective.blooms_level, true).map((f) => f.format)
          : valid;
        const candidates = preferred.length > 0
          ? preferred.filter((f) => collab_valid.includes(f))
          : collab_valid;
        const format = candidates[0] || valid[0];

        const res = await fetch("/harbour/depth-chart/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective_raw_text: objective.raw_text,
            cognitive_verb: objective.cognitive_verb,
            blooms_level: objective.blooms_level,
            knowledge_dimension: objective.knowledge_dimension,
            content_topic: objective.content_topic,
            context: objective.context,
            subject: plan.subject,
            grade_level: plan.grade_level,
            task_format: format,
            teacher_config: config,
          }),
        });

        if (!res.ok) throw new Error("generation failed");

        const task = await res.json();
        task.id = `task_${objective.id}`;
        task.objective_id = objective.id;
        task.blooms_level = objective.blooms_level;
        task.task_format = format;

        set_tasks((prev) => {
          const next = { ...prev, [objective.id]: task };
          localStorage.setItem("depth_chart_tasks", JSON.stringify(next));
          return next;
        });
      } catch (e) {
        console.error("[generate]", e);
      } finally {
        set_generating(null);
      }
    },
    [plan, config]
  );

  // per-task export options builder
  const build_task_exports = useCallback(
    (task: GeneratedTask): ExportOption[] => {
      if (!plan) return [];
      const obj = plan.objectives.find((o) => o.id === task.objective_id);
      return [
        {
          label: "PDF (branded)",
          description: "downloadable PDF with rubric, scaffold, and watermark",
          action: () => download_task_pdf(task, obj, plan.title, plan.subject, plan.grade_level),
        },
        {
          label: "QTI 2.1 (.zip)",
          description: "import into Canvas, Blackboard, or Moodle",
          action: () => download_qti_package(task, obj, plan.title, plan.subject, plan.grade_level),
        },
        {
          label: "rubric CSV",
          description: "rubric matrix for gradebooks or spreadsheets",
          action: () => download_rubric_csv(task, plan.title, plan.subject, plan.grade_level),
        },
      ];
    },
    [plan]
  );

  // bulk export options (all tasks in plan)
  const bulk_exports = useMemo((): ExportOption[] => {
    if (!plan) return [];
    const task_count = Object.keys(tasks).length;
    if (task_count === 0) return [];

    return [
      {
        label: "QTI 2.1 package (.zip)",
        description: `all ${task_count} tasks as LMS import package`,
        action: () => download_qti_plan(tasks, plan.objectives, plan.title, plan.subject, plan.grade_level),
      },
      {
        label: "all rubrics (CSV)",
        description: `${task_count} rubric matrices in one spreadsheet`,
        action: () => download_plan_rubrics_csv(tasks, plan.objectives, plan.title, plan.subject, plan.grade_level),
      },
    ];
  }, [plan, tasks]);

  if (!plan) {
    return (
      <main id="main" className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="text-[var(--color-text-on-dark-muted)]">
            no lesson plan found. upload one first.
          </p>
          <a
            href="/harbour/depth-chart/upload"
            className="text-sm text-[var(--wv-champagne)] hover:opacity-80"
          >
            ← go to upload
          </a>
        </div>
      </main>
    );
  }

  const report = build_alignment_report(plan.objectives, plan.subject);

  return (
    <main id="main" className="min-h-screen px-6 pt-24 pb-16">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* header */}
        <div className="space-y-2">
          <a
            href="/harbour/depth-chart/upload"
            className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors"
          >
            ← upload another
          </a>
          <h1 className="text-2xl font-bold text-[var(--color-text-on-dark)]">
            {plan.title || "untitled lesson plan"}
          </h1>
          <p className="text-sm text-[var(--color-text-on-dark-muted)]">
            {plan.subject} · {plan.grade_level} · {plan.objectives.length} objectives extracted
          </p>
        </div>

        {/* alignment report */}
        <AlignmentReport report={report} />

        {/* teacher config */}
        <TeacherConfigPanel
          config={config}
          on_change={update_config}
          active_levels={Array.from(new Set(plan.objectives.map((o) => o.blooms_level)))}
        />

        {/* bulk export */}
        {bulk_exports.length > 0 && (
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <p className="text-xs text-[var(--color-text-on-dark-muted)]">
              {Object.keys(tasks).length} task{Object.keys(tasks).length !== 1 ? "s" : ""} generated
            </p>
            <ExportMenu options={bulk_exports} label="export all" />
          </div>
        )}

        {/* objectives */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold tracking-[0.15em] text-[var(--color-text-on-dark-muted)]">
            learning objectives
          </h2>

          {plan.objectives.map((obj) => (
            <div key={obj.id} className="space-y-3">
              <ObjectiveCard
                objective={obj}
                on_generate={generate_task}
                is_generating={generating === obj.id}
              />

              {tasks[obj.id] && (
                <div className="ml-6 space-y-3">
                  <TaskCard
                    task={tasks[obj.id]}
                    on_view_rubric={(t) => { set_selected_task(t); set_view("rubric"); }}
                    on_view_scaffold={(t) => { set_selected_task(t); set_view("scaffold"); }}
                    export_options={build_task_exports(tasks[obj.id])}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* detail panels */}
        {selected_task && view === "rubric" && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
            <div className="bg-[var(--wv-cadet)] border border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-[var(--color-text-on-dark)]">rubric</h3>
                <button
                  onClick={() => { set_selected_task(null); set_view(null); }}
                  className="text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)]"
                >
                  close
                </button>
              </div>
              <RubricTable rubric={selected_task.rubric} />
            </div>
          </div>
        )}

        {selected_task && view === "scaffold" && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
            <div className="bg-[var(--wv-cadet)] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-[var(--color-text-on-dark)]">evaluative judgment scaffold</h3>
                <button
                  onClick={() => { set_selected_task(null); set_view(null); }}
                  className="text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)]"
                >
                  close
                </button>
              </div>
              <EJScaffoldPanel scaffold={selected_task.ej_scaffold} />
            </div>
          </div>
        )}

        {/* sign-in prompt for anonymous users */}
        <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-center">
          <p className="text-xs text-[var(--color-text-on-dark-muted)]">
            this plan is stored in your browser only.{" "}
            <a href="/harbour/depth-chart/login" className="text-[var(--wv-champagne)] hover:opacity-80 underline">
              sign in
            </a>{" "}
            to save plans to your account and access them from any device.
          </p>
        </div>

        {/* footer */}
        <footer className="text-center py-8 text-xs text-[var(--color-text-on-dark-muted)]">
          <p>
            tasks generated using constructive alignment (Biggs), scored against
            six authenticity criteria (Baquero-Vargas & Pérez-Salas), with
            evaluative judgment scaffolds (Sadler).
          </p>
        </footer>
      </div>
    </main>
  );
}
