/**
 * Demo password gate. Runs in both the proxy (edge) and server actions, so it
 * only uses Web Crypto. The cookie stores a hash of the password rather than
 * the password itself; changing DEMO_PASSWORD invalidates every session.
 */
export const AUTH_COOKIE = "primo_demo_session";
const SALT = "primo-estimator-demo-v1";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token that must be present in the session cookie for the configured password. */
export async function sessionTokenFor(password: string): Promise<string> {
  return sha256Hex(`${SALT}:${password}`);
}

/** The password gate is only active when DEMO_PASSWORD is set. */
export function gateEnabled(): boolean {
  return Boolean(process.env.DEMO_PASSWORD);
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!gateEnabled()) return true;
  if (!cookieValue) return false;
  const expected = await sessionTokenFor(process.env.DEMO_PASSWORD as string);
  return cookieValue === expected;
}
