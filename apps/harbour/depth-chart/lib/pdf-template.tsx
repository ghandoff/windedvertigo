import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { GeneratedTask, LearningObjective } from "./types";
import { TASK_FORMATS } from "./task-formats";

// colours from brand tokens (hex values since PDF renderer can't use CSS vars)
const CADET = "#273248";
const CHAMPAGNE = "#ffebd2";
const SIENNA = "#cb7858";
const MUTED = "#8b95a5";
const WHITE = "#ffffff";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf", fontWeight: 700 },
  ],
});

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: CADET,
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  header: {
    backgroundColor: CADET,
    marginHorizontal: -50,
    marginTop: -60,
    paddingHorizontal: 50,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  header_title: {
    color: CHAMPAGNE,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
  },
  header_org: {
    color: MUTED,
    fontSize: 9,
  },
  section_title: {
    fontSize: 13,
    fontWeight: 700,
    color: CADET,
    marginBottom: 8,
    marginTop: 16,
  },
  meta_row: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  meta_label: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  meta_value: {
    fontSize: 10,
    color: CADET,
  },
  objective_box: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  task_prompt: {
    backgroundColor: "#f9f6f2",
    border: `1px solid ${SIENNA}33`,
    padding: 14,
    borderRadius: 4,
    marginBottom: 12,
  },
  prompt_text: {
    fontSize: 10,
    lineHeight: 1.6,
    color: CADET,
  },
  table: {
    marginTop: 8,
    marginBottom: 12,
  },
  table_header_row: {
    flexDirection: "row",
    backgroundColor: CADET,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  table_header_cell: {
    color: CHAMPAGNE,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  table_row: {
    flexDirection: "row",
    borderBottom: `0.5px solid #e5e5e5`,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  table_cell: {
    fontSize: 8,
    color: CADET,
    lineHeight: 1.5,
  },
  col_criterion: { width: "18%" },
  col_weight: { width: "7%", textAlign: "center" },
  col_level: { width: "18.75%" },
  scaffold_box: {
    backgroundColor: "#f0f4f8",
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  scaffold_type: {
    fontSize: 8,
    color: SIENNA,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  monitoring_box: {
    backgroundColor: "#f5f0ff",
    padding: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  monitoring_label: {
    fontSize: 8,
    fontWeight: 700,
    color: "#8b5cf6",
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: `0.5px solid #e5e5e5`,
    paddingTop: 8,
  },
  footer_text: {
    fontSize: 7,
    color: MUTED,
  },
  watermark: {
    position: "absolute",
    top: "45%",
    left: "15%",
    fontSize: 48,
    color: CADET,
    opacity: 0.04,
    transform: "rotate(-30deg)",
    letterSpacing: 8,
    fontWeight: 700,
  },
});

const SCAFFOLD_LABELS: Record<string, string> = {
  peer_review: "peer review protocol",
  self_assessment: "guided self-assessment",
  exemplar_comparison: "exemplar comparison",
  criteria_co_creation: "criteria co-creation",
};

const LEVEL_LABELS = ["beginning", "developing", "proficient", "exemplary"];

interface TaskPDFProps {
  task: GeneratedTask;
  objective?: LearningObjective;
  plan_title?: string;
  subject?: string;
  grade_level?: string;
}

export function TaskPDF({ task, objective, plan_title, subject, grade_level }: TaskPDFProps) {
  const format_info = TASK_FORMATS[task.task_format];
  const rubric = task.rubric;
  const scaffold = task.ej_scaffold;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* watermark */}
        <Text style={s.watermark}>winded.vertigo</Text>

        {/* header */}
        <View style={s.header} fixed>
          <Text style={s.header_title}>depth.chart</Text>
          <Text style={s.header_org}>winded.vertigo</Text>
        </View>

        {/* metadata */}
        {plan_title && (
          <View style={s.meta_row}>
            <View>
              <Text style={s.meta_label}>lesson plan</Text>
              <Text style={s.meta_value}>{plan_title}</Text>
            </View>
          </View>
        )}
        <View style={s.meta_row}>
          {subject && (
            <View>
              <Text style={s.meta_label}>subject</Text>
              <Text style={s.meta_value}>{subject}</Text>
            </View>
          )}
          {grade_level && (
            <View>
              <Text style={s.meta_label}>grade level</Text>
              <Text style={s.meta_value}>{grade_level}</Text>
            </View>
          )}
          <View>
            <Text style={s.meta_label}>format</Text>
            <Text style={s.meta_value}>{format_info.label}</Text>
          </View>
          <View>
            <Text style={s.meta_label}>bloom's level</Text>
            <Text style={s.meta_value}>{task.blooms_level}</Text>
          </View>
          <View>
            <Text style={s.meta_label}>time</Text>
            <Text style={s.meta_value}>~{task.time_estimate_minutes} min</Text>
          </View>
        </View>

        {/* objective */}
        {objective && (
          <>
            <Text style={s.section_title}>learning objective</Text>
            <View style={s.objective_box}>
              <Text style={s.prompt_text}>{objective.raw_text}</Text>
            </View>
          </>
        )}

        {/* task prompt */}
        <Text style={s.section_title}>assessment task</Text>
        <View style={s.task_prompt}>
          <Text style={s.prompt_text}>{task.prompt_text}</Text>
        </View>

        {/* rubric */}
        <Text style={s.section_title}>analytic rubric</Text>
        <View style={s.table}>
          <View style={s.table_header_row}>
            <Text style={[s.table_header_cell, s.col_criterion]}>criterion</Text>
            <Text style={[s.table_header_cell, s.col_weight]}>wt.</Text>
            {LEVEL_LABELS.map((l) => (
              <Text key={l} style={[s.table_header_cell, s.col_level]}>{l}</Text>
            ))}
          </View>
          {rubric.criteria.map((c, i) => (
            <View key={i} style={s.table_row} wrap={false}>
              <View style={s.col_criterion}>
                <Text style={[s.table_cell, { fontWeight: 700 }]}>{c.name}</Text>
                <Text style={[s.table_cell, { color: MUTED, fontSize: 7 }]}>
                  {c.blooms_alignment} / {c.authenticity_dimension}
                </Text>
              </View>
              <Text style={[s.table_cell, s.col_weight]}>
                {(c.weight * 100).toFixed(0)}%
              </Text>
              {LEVEL_LABELS.map((label) => {
                const level = c.levels.find((l) => l.label === label);
                return (
                  <Text key={label} style={[s.table_cell, s.col_level]}>
                    {level?.behavioral_anchor || "—"}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>

        {/* EJ scaffold */}
        <Text style={s.section_title}>evaluative judgment scaffold</Text>
        <View style={s.scaffold_box}>
          <Text style={s.scaffold_type}>
            {SCAFFOLD_LABELS[scaffold.type] || scaffold.type}
          </Text>
          <Text style={s.prompt_text}>{scaffold.prompt_text}</Text>

          {scaffold.self_monitoring_prompt && (
            <View style={s.monitoring_box}>
              <Text style={s.monitoring_label}>self-monitoring check</Text>
              <Text style={s.prompt_text}>{scaffold.self_monitoring_prompt}</Text>
            </View>
          )}
        </View>

        {/* footer */}
        <View style={s.footer} fixed>
          <Text style={s.footer_text}>
            depth.chart by winded.vertigo — constructive alignment + evaluative judgment
          </Text>
          <Text style={s.footer_text}>
            generated {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }).toLowerCase()}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
