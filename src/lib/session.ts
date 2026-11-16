import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export const SESSION_COOKIE = "aitalented_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = Prisma.UserGetPayload<{
  include: { profile: true; recruiter: true };
}>;

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: { id: token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: token } });
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: { include: { profile: true, recruiter: true } } },
  });

  if (!session || session.expiresAt < new Date() || session.user.status !== "active") {
    return null;
  }
  return session.user;
}
