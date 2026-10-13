import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessionRevocations } from "@/db/schema";

export async function isSessionRevoked(jti: string) {
  const revoked = await getDb().query.sessionRevocations.findFirst({ where: eq(sessionRevocations.jti, jti) });
  return Boolean(revoked);
}

export async function revokeSession(jti: string, expiresAt: Date) {
  const db = getDb();
  await db.insert(sessionRevocations).values({ jti, expiresAt }).onConflictDoNothing();
  await db.delete(sessionRevocations).where(lt(sessionRevocations.expiresAt, new Date()));
}
