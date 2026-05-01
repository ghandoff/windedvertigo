/**
 * generate a human-friendly room code.
 *
 * uses uppercase letters + digits, excluding ambiguous chars (0/O, 1/I/L).
 * 5 chars gives ~28M combinations — plenty for ephemeral sessions.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5): string {
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length < 4 || code.length > 6) return false;
  return /^[A-Z0-9]+$/.test(code);
}
