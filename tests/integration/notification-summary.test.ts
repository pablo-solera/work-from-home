import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { findNotificationSummary } from "@/lib/requests/request-repository";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");

const sql = postgres(databaseUrl, { max: 2, onnotice: () => undefined });
const coordinatorId = "00000000-0000-4000-8000-0000000000b1";
const otherCoordinatorId = "00000000-0000-4000-8000-0000000000b2";
const employeeId = "00000000-0000-4000-8000-0000000000b3";
const userIds = [coordinatorId, otherCoordinatorId, employeeId];

async function cleanup() {
  await sql`DELETE FROM wfh_change_request_dates WHERE request_id IN (SELECT id FROM wfh_change_requests WHERE requester_id = ${employeeId})`;
  await sql`DELETE FROM wfh_change_requests WHERE requester_id = ${employeeId}`;
  await sql`DELETE FROM users WHERE id IN ${sql(userIds)}`;
}

async function insertRequest(values: { kind: string; status?: string; coordinator?: string; coordinatorNotified?: boolean; adminNotified?: boolean }) {
  const [request] = await sql`
    INSERT INTO wfh_change_requests (requester_id, coordinator_id, kind, status, coordinator_notified_at, admin_notified_at)
    VALUES (${employeeId}, ${values.coordinator ?? coordinatorId}, ${values.kind}, ${values.status ?? "pending"},
            ${values.coordinatorNotified ? sql`now()` : null}, ${values.adminNotified ? sql`now()` : null})
    RETURNING id`;
  return request.id as string;
}

describe("request notification summary", () => {
  beforeEach(async () => {
    await cleanup();
    await sql`INSERT INTO users (id, fallback_name, fallback_email) VALUES
      (${coordinatorId}, 'Coord', 'coord-summary@example.com'),
      (${otherCoordinatorId}, 'Other', 'other-summary@example.com'),
      (${employeeId}, 'Employee', 'employee-summary@example.com')`;
  });

  afterAll(async () => {
    await cleanup();
    await sql.end();
  });

  it("counts pending additional requests for admins and unread substitutions as informational", async () => {
    await insertRequest({ kind: "additional" });
    await insertRequest({ kind: "additional", status: "accepted" });
    await insertRequest({ kind: "substitution", adminNotified: true });
    await insertRequest({ kind: "substitution", status: "accepted" });

    const [summary] = await findNotificationSummary("any", "admin");
    expect(Number(summary.actionableRequestCount)).toBeGreaterThanOrEqual(1);
    expect(Number(summary.informationalRequestCount)).toBeGreaterThanOrEqual(1);
    expect(typeof summary.revision).toBe("string");
  });

  it("scopes coordinator counts to their own team requests and unread notices", async () => {
    await insertRequest({ kind: "additional" });
    await insertRequest({ kind: "substitution", coordinatorNotified: true });
    await insertRequest({ kind: "removal", coordinatorNotified: true });
    await insertRequest({ kind: "substitution" });
    await insertRequest({ kind: "additional", coordinator: otherCoordinatorId });

    const [summary] = await findNotificationSummary(coordinatorId, "coordinator");
    expect(Number(summary.actionableRequestCount)).toBe(0);
    expect(Number(summary.informationalRequestCount)).toBe(3);
    const [other] = await findNotificationSummary(otherCoordinatorId, "coordinator");
    expect(Number(other.informationalRequestCount)).toBe(1);
  });

  it("changes the revision when a request is updated or one of its dates is cancelled", async () => {
    const requestId = await insertRequest({ kind: "additional" });
    const [dateRow] = await sql`INSERT INTO wfh_change_request_dates (request_id, requested_date) VALUES (${requestId}, '2099-02-02') RETURNING id`;
    const [first] = await findNotificationSummary(coordinatorId, "coordinator");

    await sql`UPDATE wfh_change_requests SET decision_comment = 'ok' WHERE id = ${requestId}`;
    const [afterUpdate] = await findNotificationSummary(coordinatorId, "coordinator");
    expect(afterUpdate.revision).not.toBe(first.revision);

    await sql`UPDATE wfh_change_request_dates SET cancelled_at = now() + interval '1 second' WHERE id = ${dateRow.id}`;
    const [afterCancel] = await findNotificationSummary(coordinatorId, "coordinator");
    expect(afterCancel.revision).not.toBe(afterUpdate.revision);

    const [unchanged] = await findNotificationSummary(coordinatorId, "coordinator");
    expect(unchanged.revision).toBe(afterCancel.revision);
  });
});
