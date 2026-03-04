import { sql } from "@/lib/db";

export interface DbUser {
  id: string;
  email: string;
  email_verified: boolean;
  name: string | null;
  image: string | null;
  created_at: string;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email} LIMIT 1
  `;
  return result.rows[0] as DbUser | undefined ?? null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const result = await sql`
    SELECT * FROM users WHERE id = ${id} LIMIT 1
  `;
  return result.rows[0] as DbUser | undefined ?? null;
}

export async function createUser(email: string, name?: string): Promise<DbUser> {
  const result = await sql`
    INSERT INTO users (email, name)
    VALUES (${email}, ${name ?? null})
    RETURNING *
  `;
  return result.rows[0] as DbUser;
}

export async function updateUser(
  id: string,
  fields: { name?: string; email_verified?: boolean; image?: string },
): Promise<void> {
  const parts: string[] = [];
  const values: unknown[] = [];

  if (fields.name !== undefined) {
    parts.push("name = $" + (values.length + 1));
    values.push(fields.name);
  }
  if (fields.email_verified !== undefined) {
    parts.push("email_verified = $" + (values.length + 1));
    values.push(fields.email_verified);
  }
  if (fields.image !== undefined) {
    parts.push("image = $" + (values.length + 1));
    values.push(fields.image);
  }

  if (parts.length === 0) return;

  parts.push("updated_at = NOW()");
  values.push(id);

  await sql.query(
    `UPDATE users SET ${parts.join(", ")} WHERE id = $${values.length}`,
    values,
  );
}
