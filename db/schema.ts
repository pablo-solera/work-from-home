import { isNotNull, relations } from "drizzle-orm";
import { boolean, index, date, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const wfhRequestKind = pgEnum("wfh_request_kind", ["additional", "substitution"]);
export const wfhRequestStatus = pgEnum("wfh_request_status", ["pending", "accepted", "rejected", "cancelled"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  passwordHash: text("password_hash").notNull(),
  oracleEmpId: integer("oracle_emp_id"),
  // Identity (name/email/wd number) normally lives in Oracle (TIMERTASK).
  // fallback_* also identifies explicitly configured local test accounts.
  fallbackEmail: text("fallback_email"),
  fallbackName: text("fallback_name"),
  hasWfh: boolean("has_wfh"),
  teamWfhVisible: boolean("team_wfh_visible").notNull().default(false),
  canEditAllWfh: boolean("can_edit_all_wfh").notNull().default(false),
  wfhDaysAllowance: integer("wfh_days_allowance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_oracle_emp_id_unique").on(table.oracleEmpId).where(isNotNull(table.oracleEmpId)),
  uniqueIndex("users_fallback_email_unique").on(table.fallbackEmail).where(isNotNull(table.fallbackEmail)),
]);

export const workFromHomeDays = pgTable(
  "work_from_home_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("work_from_home_days_user_date_idx").on(table.userId, table.date),
    index("work_from_home_days_date_user_idx").on(table.date, table.userId),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  workFromHomeDays: many(workFromHomeDays),
}));

export const workFromHomeDaysRelations = relations(workFromHomeDays, ({ one }) => ({
  user: one(users, {
    fields: [workFromHomeDays.userId],
    references: [users.id],
  }),
}));

export const wfhChangeRequests = pgTable("wfh_change_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  coordinatorId: uuid("coordinator_id").references(() => users.id, { onDelete: "restrict" }),
  kind: wfhRequestKind("kind").notNull(),
  status: wfhRequestStatus("status").notNull().default("pending"),
  requesterComment: text("requester_comment"),
  decisionComment: text("decision_comment"),
  decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  coordinatorNotifiedAt: timestamp("coordinator_notified_at", { withTimezone: true }),
  coordinatorAcknowledgedAt: timestamp("coordinator_acknowledged_at", { withTimezone: true }),
  adminNotifiedAt: timestamp("admin_notified_at", { withTimezone: true }),
  adminAcknowledgedAt: timestamp("admin_acknowledged_at", { withTimezone: true }),
}, (table) => [
  index("wfh_change_requests_requester_status_idx").on(table.requesterId, table.status),
  index("wfh_change_requests_requester_created_idx").on(table.requesterId, table.createdAt, table.id),
  index("wfh_change_requests_coordinator_status_idx").on(table.coordinatorId, table.status),
  index("wfh_change_requests_coordinator_created_idx").on(table.coordinatorId, table.createdAt, table.id),
  index("wfh_change_requests_kind_status_created_idx").on(table.kind, table.status, table.createdAt, table.id),
  index("wfh_change_requests_coordinator_notification_idx").on(table.coordinatorId, table.coordinatorNotifiedAt, table.coordinatorAcknowledgedAt),
  index("wfh_change_requests_admin_notification_idx").on(table.adminNotifiedAt, table.adminAcknowledgedAt),
]);

export const wfhChangeRequestDates = pgTable(
  "wfh_change_request_dates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => wfhChangeRequests.id, { onDelete: "cascade" }),
    requestedDate: date("requested_date").notNull(),
    replacedDate: date("replaced_date"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledById: uuid("cancelled_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("wfh_change_request_dates_request_date_idx").on(table.requestId, table.requestedDate), index("wfh_change_request_dates_active_date_idx").on(table.requestedDate)],
);

export const wfhChangeRequestsRelations = relations(wfhChangeRequests, ({ many, one }) => ({
  requester: one(users, { fields: [wfhChangeRequests.requesterId], references: [users.id], relationName: "wfhRequestRequester" }),
  coordinator: one(users, { fields: [wfhChangeRequests.coordinatorId], references: [users.id], relationName: "wfhRequestCoordinator" }),
  decidedBy: one(users, { fields: [wfhChangeRequests.decidedById], references: [users.id], relationName: "wfhRequestDecider" }),
  dates: many(wfhChangeRequestDates),
}));

export const wfhChangeRequestDatesRelations = relations(wfhChangeRequestDates, ({ one }) => ({
  request: one(wfhChangeRequests, { fields: [wfhChangeRequestDates.requestId], references: [wfhChangeRequests.id] }),
}));

export type UserRole = "admin" | "coordinator" | "employee";
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
