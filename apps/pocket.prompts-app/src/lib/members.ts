// bundled member list — matches config/members.json in the backend.
// bundled instead of fetched to avoid an extra API call on startup.

export interface Member {
  id: string;
  email: string;
}

export const members: Member[] = [
  { id: 'garrett', email: 'garrett@windedvertigo.com' },
  { id: 'jamie', email: 'jamie@windedvertigo.com' },
  { id: 'lamis', email: 'lamis@windedvertigo.com' },
  { id: 'maria', email: 'maria@windedvertigo.com' },
  { id: 'payton', email: 'payton@windedvertigo.com' },
  { id: 'august', email: 'clients@augustkinloch.com' },
];
