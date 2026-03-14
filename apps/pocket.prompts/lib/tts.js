// spoken response builders — designed to be read aloud via tts.
// rules: one to two sentences, conversational, confirm the action, use names, never read urls.
// every response ends with a CTA so the user knows what to say next through airpods.

export function note_captured(priority) {
  return `noted — added to your inbox as a ${priority}-priority note. anything else, or should i check your slack?`;
}

export function idea_captured(priority) {
  return `nice — i've captured that idea as ${priority} priority. want to add another, or check messages?`;
}

export function task_assigned(assignee, due_date) {
  let response = `done — assigned to ${assignee}`;
  if (due_date) {
    response += ` with a ${due_date} due date`;
  }
  response += `. want to assign another task, or do something else?`;
  return response;
}

export function slack_sent(recipient) {
  return `sent — message delivered to ${recipient}. want to send another, or check for replies?`;
}

export function slack_reply_sent(recipient) {
  return `replied to ${recipient}. anything else to say to them, or should i move on?`;
}

export function slack_no_messages() {
  return `all clear — no new messages right now. want to capture a note or idea instead?`;
}

export function code_task_created(project) {
  const proj = project ? ` for ${project}` : '';
  return `queued — i've created a code task${proj}. claude code will generate a plan and send you a summary. anything else?`;
}

export function code_approved() {
  return `approved — claude code will start implementing. i'll message you on slack when it's done. anything else?`;
}

export function code_status_update(request_preview, status, plan_summary) {
  const preview = request_preview ? `"${request_preview}"` : 'your code request';

  if (status === 'pending') {
    return `${preview} is queued and waiting for claude code to generate a plan. i'll send you a summary when it's ready. anything else?`;
  }
  if (status === 'planning') {
    return `claude code is working on a plan for ${preview} right now. i'll message you when the plan is ready. anything else?`;
  }
  if (status === 'plan ready' && plan_summary) {
    return `plan ready for ${preview}. ${plan_summary} say "approve the plan" to proceed, or "revise the plan" with feedback.`;
  }
  if (status === 'plan ready') {
    return `there's a plan ready for ${preview}. say "approve the plan" to proceed, or "revise the plan" with feedback.`;
  }
  if (status === 'revision') {
    return `claude code is revising the plan for ${preview} based on your feedback. i'll send you the updated plan. anything else?`;
  }
  if (status === 'approved' || status === 'implementing') {
    return `claude code is implementing ${preview} right now. i'll send you a slack message when it's done. anything else?`;
  }
  if (status === 'complete') {
    return `${preview} is complete. check your slack for the details, or start a new code task.`;
  }
  if (status === 'failed') {
    return `the code task for ${preview} ran into an issue. check your slack for details, or try again with a new request.`;
  }

  return `${preview} is currently ${status}. anything else?`;
}

export function code_revision_sent() {
  return `got it — revision notes saved. claude code will update the plan on the next cycle. anything else?`;
}

export function code_revision_limit() {
  return `this task has hit the 20-message limit. you can approve the current plan or start a fresh code task. what would you like?`;
}

export function code_no_plan_to_revise() {
  return `i don't see a plan waiting for revision. want to check the code status instead?`;
}

export function code_no_tasks() {
  return `no active code tasks right now. want to start one? just say what you need built.`;
}

// legacy — kept for backward compatibility
export function code_conversation_queued() {
  return `queued — claude code will pick that up next time it checks in. anything else?`;
}

export function code_conversation_started() {
  return `started — primed message is in your slack dms. grab it when you're at your desk. anything else?`;
}

export function build_approval_sent() {
  return `approved — build webhook fired. want to check slack or capture something?`;
}

export function clarifying(question) {
  return question || "i'm not sure what you meant — could you say that again, or try a different way?";
}

export function goodbye() {
  return "okay, we're done — talk to you later!";
}

export function error_fallback() {
  return "something went wrong — want me to try again, or do something else?";
}
