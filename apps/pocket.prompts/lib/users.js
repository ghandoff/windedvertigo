import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const members = require('../config/members.json');

const name_aliases = {
  garrett: 'garrett',
  gar: 'garrett',
  jamie: 'jamie',
  lamis: 'lamis',
  maria: 'maria',
  payton: 'payton',
  pay: 'payton'
};

export function resolve_member(name) {
  if (!name) return null;

  const normalized = name.toLowerCase().trim();
  const canonical = name_aliases[normalized] || normalized;
  const member = members[canonical];

  if (!member) {
    console.log(`[users] could not resolve member: "${name}"`);
    return null;
  }

  return { name: canonical, ...member };
}

export function get_all_members() {
  return members;
}

export function get_notion_user_id(name) {
  const member = resolve_member(name);
  return member?.notion_user_id || null;
}

export function get_slack_user_id(name) {
  const member = resolve_member(name);
  return member?.slack_user_id || null;
}
