// unambiguous alphabet — no 0/O, 1/I, 5/S
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ23467989";

export function generateRoomCode(length = 6): string {
  let code = "";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[values[i] % ALPHABET.length];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== 6) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
