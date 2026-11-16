import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", service: "web", at: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded", service: "web" }, { status: 503 });
  }
}
