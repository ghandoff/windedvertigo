/**
 * QTI 2.1 XML builder for depth.chart assessment tasks.
 *
 * generates IMS QTI 2.1 compliant XML from a GeneratedTask.
 * these items use <extendedTextInteraction> since depth.chart
 * produces open-ended assessments, not multiple-choice.
 *
 * spec reference: https://www.imsglobal.org/question/qtiv2p1/imsqti_implv2p1.html
 */

import type { GeneratedTask, LearningObjective, AnalyticRubric } from "./types";
import { TASK_FORMATS } from "./task-formats";

// ── XML escaping ─────────────────────────────────────────

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── QTI assessment item ──────────────────────────────────

export function build_qti_item(
  task: GeneratedTask,
  objective?: LearningObjective,
  meta?: { plan_title?: string; subject?: string; grade_level?: string }
): string {
  const id = task.id || `dc_item_${Date.now()}`;
  const format = TASK_FORMATS[task.task_format];
  const title = format
    ? `${format.label} — ${task.blooms_level}`
    : task.blooms_level;

  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
                identifier="${esc(id)}"
                title="${esc(title)}"
                timeDependent="false"
                adaptive="false">

  <!-- metadata -->
  <itemBody>
${objective ? `    <rubricBlock view="author">
      <p><strong>learning objective:</strong> ${esc(objective.raw_text)}</p>
      <p><strong>cognitive level:</strong> ${esc(task.blooms_level)} (Bloom's revised taxonomy)</p>
      <p><strong>knowledge dimension:</strong> ${esc(objective?.knowledge_dimension || "")}</p>
${meta?.subject ? `      <p><strong>subject:</strong> ${esc(meta.subject)}</p>\n` : ""}${meta?.grade_level ? `      <p><strong>grade level:</strong> ${esc(meta.grade_level)}</p>\n` : ""}      <p><strong>format:</strong> ${esc(format?.label || task.task_format)}</p>
      <p><strong>estimated time:</strong> ~${task.time_estimate_minutes} minutes</p>
    </rubricBlock>

` : ""}    <!-- task prompt -->
    <div class="dc-task-prompt">
      <p>${esc(task.prompt_text)}</p>
    </div>

    <!-- response area (extended text for open-ended tasks) -->
    <extendedTextInteraction responseIdentifier="RESPONSE"
                             expectedLength="${Math.max(200, task.time_estimate_minutes * 20)}">
      <prompt>
        <p>enter your response below.</p>
      </prompt>
    </extendedTextInteraction>
  </itemBody>

${build_rubric_block(task.rubric)}
</assessmentItem>`;
}

// ── rubric block ─────────────────────────────────────────

function build_rubric_block(rubric: AnalyticRubric): string {
  const levels = ["exemplary", "proficient", "developing", "beginning"] as const;

  let xml = `  <!-- analytic rubric (assessor view) -->
  <rubricBlock view="scorer">
    <div class="dc-rubric">
      <table>
        <thead>
          <tr>
            <th>criterion</th>
            <th>weight</th>
${levels.map((l) => `            <th>${l}</th>`).join("\n")}
          </tr>
        </thead>
        <tbody>\n`;

  for (const criterion of rubric.criteria) {
    xml += `          <tr>
            <td><strong>${esc(criterion.name)}</strong><br/>${esc(criterion.blooms_alignment)} / ${esc(criterion.authenticity_dimension)}</td>
            <td>${(criterion.weight * 100).toFixed(0)}%</td>\n`;

    for (const label of levels) {
      const level = criterion.levels.find((l) => l.label === label);
      xml += `            <td>${esc(level?.behavioral_anchor || "—")}</td>\n`;
    }
    xml += `          </tr>\n`;
  }

  xml += `        </tbody>
      </table>
    </div>
  </rubricBlock>`;

  return xml;
}

// ── IMS manifest ─────────────────────────────────────────

export function build_manifest(
  items: { id: string; filename: string; title: string }[],
  package_title: string
): string {
  const manifest_id = `dc_manifest_${Date.now()}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p1"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/qtiv2p1_imscpv1p2_v1p0.xsd
                              http://www.imsglobal.org/xsd/imsmd_v1p2 http://www.imsglobal.org/xsd/imsmd_v1p2p2.xsd
                              http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
          identifier="${manifest_id}">

  <metadata>
    <schema>QTIv2.1 Package</schema>
    <schemaversion>2.1</schemaversion>
    <imsmd:lom>
      <imsmd:general>
        <imsmd:title>
          <imsmd:langstring xml:lang="en">${esc(package_title)}</imsmd:langstring>
        </imsmd:title>
        <imsmd:description>
          <imsmd:langstring xml:lang="en">assessment tasks generated by depth.chart (winded.vertigo) using constructive alignment and Bloom's revised taxonomy.</imsmd:langstring>
        </imsmd:description>
      </imsmd:general>
    </imsmd:lom>
  </metadata>

  <organizations/>

  <resources>
${items
  .map(
    (item) => `    <resource identifier="${esc(item.id)}" type="imsqti_item_xmlv2p1" href="${esc(item.filename)}">
      <metadata>
        <imsqti:qtiMetadata>
          <imsqti:interactionType>extendedTextInteraction</imsqti:interactionType>
        </imsqti:qtiMetadata>
      </metadata>
      <file href="${esc(item.filename)}"/>
    </resource>`
  )
  .join("\n")}
  </resources>
</manifest>`;
}
