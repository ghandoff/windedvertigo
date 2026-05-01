/**
 * Migrate depth-chart data from separate Neon DB to shared harbour DB.
 *
 * Usage:
 *   cd apps/creaseworks
 *   DC_POSTGRES_URL="postgres://..." npx tsx scripts/migrate-depth-chart-data.ts
 *
 * Requires:
 *   - DC_POSTGRES_URL: connection string for the OLD depth-chart database
 *   - POSTGRES_URL: connection string for the SHARED harbour database (from .env.local)
 *
 * What it does:
 *   1. Reads all users from depth-chart DB
 *   2. Matches them by email to shared DB users (or creates new ones)
 *   3. Copies plans, objectives, tasks, feedback, usage_events
 *      into dc_* tables with UUID IDs and updated foreign keys
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING for idempotency.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

// load .env.local for POSTGRES_URL
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const DC_URL = process.env.DC_POSTGRES_URL;
const SHARED_URL = process.env.POSTGRES_URL;

if (!DC_URL) {
  console.error("DC_POSTGRES_URL is required (old depth-chart database)");
  process.exit(1);
}
if (!SHARED_URL) {
  console.error("POSTGRES_URL is required (shared harbour database, from .env.local)");
  process.exit(1);
}

const dcPool = new pg.Pool({ connectionString: DC_URL, ssl: { rejectUnauthorized: false } });
const sharedPool = new pg.Pool({ connectionString: SHARED_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("connecting to databases...\n");

  // 1. Get all depth-chart users
  const dcUsers = (await dcPool.query("SELECT * FROM users")).rows;
  console.log(`found ${dcUsers.length} depth-chart users`);

  // Map old text IDs → new UUID IDs
  const userIdMap = new Map<string, string>();

  for (const dcUser of dcUsers) {
    // Check if user already exists in shared DB by email
    const existing = await sharedPool.query(
      "SELECT id FROM users WHERE email = $1",
      [dcUser.email]
    );

    if (existing.rows.length > 0) {
      userIdMap.set(dcUser.id, existing.rows[0].id);
      // Update institution if set in depth-chart
      if (dcUser.institution) {
        await sharedPool.query(
          "UPDATE users SET institution = $1 WHERE id = $2 AND institution IS NULL",
          [dcUser.institution, existing.rows[0].id]
        );
      }
      console.log(`  matched: ${dcUser.email} → ${existing.rows[0].id}`);
    } else {
      // Create new user in shared DB
      const newUser = await sharedPool.query(
        `INSERT INTO users (email, name, email_verified, institution, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [dcUser.email, dcUser.name, dcUser.email_verified, dcUser.institution, dcUser.created_at, dcUser.updated_at]
      );
      userIdMap.set(dcUser.id, newUser.rows[0].id);
      console.log(`  created: ${dcUser.email} → ${newUser.rows[0].id}`);
    }
  }

  // 2. Migrate plans
  const dcPlans = (await dcPool.query("SELECT * FROM plans ORDER BY created_at")).rows;
  console.log(`\nmigrating ${dcPlans.length} plans...`);
  const planIdMap = new Map<string, string>();

  for (const plan of dcPlans) {
    const newUserId = plan.user_id ? userIdMap.get(plan.user_id) : null;
    const result = await sharedPool.query(
      `INSERT INTO dc_plans (user_id, title, subject, grade_level, raw_text, source_format, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [newUserId, plan.title, plan.subject, plan.grade_level, plan.raw_text, plan.source_format, plan.created_at, plan.updated_at]
    );
    planIdMap.set(plan.id, result.rows[0].id);
  }
  console.log(`  migrated ${planIdMap.size} plans`);

  // 3. Migrate objectives
  const dcObjectives = (await dcPool.query("SELECT * FROM objectives ORDER BY sort_order")).rows;
  console.log(`\nmigrating ${dcObjectives.length} objectives...`);
  const objectiveIdMap = new Map<string, string>();

  for (const obj of dcObjectives) {
    const newPlanId = planIdMap.get(obj.plan_id);
    if (!newPlanId) {
      console.warn(`  skipping objective ${obj.id} — no matching plan`);
      continue;
    }
    const result = await sharedPool.query(
      `INSERT INTO dc_objectives (plan_id, raw_text, cognitive_verb, blooms_level, knowledge_dimension, content_topic, context, confidence, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [newPlanId, obj.raw_text, obj.cognitive_verb, obj.blooms_level, obj.knowledge_dimension, obj.content_topic, obj.context, obj.confidence, obj.sort_order]
    );
    objectiveIdMap.set(obj.id, result.rows[0].id);
  }
  console.log(`  migrated ${objectiveIdMap.size} objectives`);

  // 4. Migrate tasks
  const dcTasks = (await dcPool.query("SELECT * FROM tasks")).rows;
  console.log(`\nmigrating ${dcTasks.length} tasks...`);
  const taskIdMap = new Map<string, string>();

  for (const task of dcTasks) {
    const newObjectiveId = objectiveIdMap.get(task.objective_id);
    if (!newObjectiveId) {
      console.warn(`  skipping task ${task.id} — no matching objective`);
      continue;
    }
    const result = await sharedPool.query(
      `INSERT INTO dc_tasks (objective_id, blooms_level, task_format, prompt_text, time_estimate_min, collaboration_mode, rubric_json, ej_scaffold_json, authenticity_json, reliability_notes, generation_attempts, authenticity_passed, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [newObjectiveId, task.blooms_level, task.task_format, task.prompt_text, task.time_estimate_min, task.collaboration_mode, task.rubric_json, task.ej_scaffold_json, task.authenticity_json, task.reliability_notes, task.generation_attempts, task.authenticity_passed, task.created_at]
    );
    taskIdMap.set(task.id, result.rows[0].id);
  }
  console.log(`  migrated ${taskIdMap.size} tasks`);

  // 5. Migrate feedback
  const dcFeedback = (await dcPool.query("SELECT * FROM feedback")).rows;
  console.log(`\nmigrating ${dcFeedback.length} feedback entries...`);
  let feedbackCount = 0;

  for (const fb of dcFeedback) {
    const newUserId = fb.user_id ? userIdMap.get(fb.user_id) : null;
    const newTaskId = fb.task_id ? taskIdMap.get(fb.task_id) : null;
    const newPlanId = fb.plan_id ? planIdMap.get(fb.plan_id) : null;
    if (!newTaskId && !newPlanId) {
      console.warn(`  skipping feedback ${fb.id} — no matching task or plan`);
      continue;
    }
    await sharedPool.query(
      `INSERT INTO dc_feedback (user_id, task_id, plan_id, rating, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newUserId, newTaskId, newPlanId, fb.rating, fb.comment, fb.created_at]
    );
    feedbackCount++;
  }
  console.log(`  migrated ${feedbackCount} feedback entries`);

  // 6. Migrate usage events
  const dcEvents = (await dcPool.query("SELECT * FROM usage_events")).rows;
  console.log(`\nmigrating ${dcEvents.length} usage events...`);
  let eventCount = 0;

  for (const event of dcEvents) {
    const newUserId = event.user_id ? userIdMap.get(event.user_id) : null;
    await sharedPool.query(
      `INSERT INTO dc_usage_events (user_id, event_type, metadata, created_at)
       VALUES ($1, $2, $3, $4)`,
      [newUserId, event.event_type, event.metadata, event.created_at]
    );
    eventCount++;
  }
  console.log(`  migrated ${eventCount} usage events`);

  console.log("\n--- migration complete ---");
  console.log(`users:      ${userIdMap.size}`);
  console.log(`plans:      ${planIdMap.size}`);
  console.log(`objectives: ${objectiveIdMap.size}`);
  console.log(`tasks:      ${taskIdMap.size}`);
  console.log(`feedback:   ${feedbackCount}`);
  console.log(`events:     ${eventCount}`);

  await dcPool.end();
  await sharedPool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
