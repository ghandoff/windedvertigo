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
