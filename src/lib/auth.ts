import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getSessionUser, type SessionUser } from "./session";

export { recruiterHasAccess } from "./access";

export async function requireUser(next = "/"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireRole(role: Role, next = "/"): Promise<SessionUser> {
  const user = await requireUser(next);
  if (user.role !== role) redirect(homeForRole(user.role));
  return user;
}

export function homeForRole(role: Role): string {
  if (role === "candidate") return "/candidate";
  if (role === "recruiter") return "/recruiter";
  return "/admin";
}
