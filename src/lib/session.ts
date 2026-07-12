import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AppUser } from "./types";

const USER_COOKIE = "tdiv_session";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const configured = process.env.APP_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "dev-session-secret-change-me";
  throw new Error("APP_SESSION_SECRET is required in production");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode<T>(token?: string): T | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

export async function getUserSession() {
  const cookieStore = await cookies();
  return decode<AppUser>(cookieStore.get(USER_COOKIE)?.value);
}

export async function setUserSession(user: AppUser) {
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, encode(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_SECONDS,
    path: "/"
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE);
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}
