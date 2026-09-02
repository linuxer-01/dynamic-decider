// Server-only helpers for the judging system. Never import from client code.
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const ADMIN_COOKIE = "ejs_admin";

function adminPassword(): string {
  const pw = process.env["ADMIN_PASSWORD"];
  if (!pw) throw new Error("ADMIN_PASSWORD is not configured");
  return pw;
}

function sign(value: string): string {
  return createHmac("sha256", adminPassword()).update(value).digest("hex");
}

export function checkPassword(input: string): boolean {
  const a = Buffer.from(sign(input));
  const b = Buffer.from(sign(adminPassword()));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueAdminToken(): string {
  const payload = `${Date.now()}.${randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const a = Buffer.from(parts[2] ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const issued = Number(parts[0]);
  if (!Number.isFinite(issued)) return false;
  // 24 hour session
  return Date.now() - issued < 24 * 60 * 60 * 1000;
}

export function readCookie(header: string | undefined | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}
