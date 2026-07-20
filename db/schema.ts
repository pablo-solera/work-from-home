import { relations } from "drizzle-orm";
import { boolean, index, type AnyPgColumn, date, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "coordinator", "employee"]);
export const wfhRequestKind = pgEnum("wfh_request_kind", ["additional", "substitution"]);
export const wfhRequestStatus = pgEnum("wfh_request_status", ["pending", "accepted", "rejected", "cancelled"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("employee"),
  coordinatorId: uuid("coordinator_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  oracleEmpId: integer("oracle_emp_id").unique(),
  // Identity (name/email/wd number) lives in Oracle (TIMERTASK). These fallback
  // fields are only used for system accounts that have no Oracle employee
  // (oracleEmpId null), e.g. the app admin, so they can still log in without
  // depending on Oracle.
  fallbackEmail: text("fallback_email").unique(),
  fallbackName: text("fallback_name"),
  hasWfh: boolean("has_wfh"),
  teamWfhVisible: boolean("team_wfh_visible").notNull().default(false),
  canEditAllWfh: boolean("can_edit_all_wfh").notNull().default(false),
  wfhDaysAllowance: integer("wfh_days_allowance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  (table) => [uniqueIndex("work_from_home_days_user_date_idx").on(table.userId, table.date)]
);

export const usersRelations = relations(users, ({ many, one }) => ({
  coordinator: one(users, {
    fields: [users.coordinatorId],
    references: [users.id],
    relationName: "coordinatorEmployees",
  }),
  employees: many(users, { relationName: "coordinatorEmployees" }),
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
  coordinatorId: uuid("coordinator_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  kind: wfhRequestKind("kind").notNull(),
  status: wfhRequestStatus("status").notNull().default("pending"),
  requesterComment: text("requester_comment"),
  decisionComment: text("decision_comment"),
  decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  coordinatorNotifiedAt: timestamp("coordinator_notified_at", { withTimezone: true }),
  coordinatorAcknowledgedAt: timestamp("coordinator_acknowledged_at", { withTimezone: true }),
}, (table) => [
  index("wfh_change_requests_requester_status_idx").on(table.requesterId, table.status),
  index("wfh_change_requests_requester_created_idx").on(table.requesterId, table.createdAt, table.id),
  index("wfh_change_requests_coordinator_status_idx").on(table.coordinatorId, table.status),
  index("wfh_change_requests_coordinator_created_idx").on(table.coordinatorId, table.createdAt, table.id),
  index("wfh_change_requests_coordinator_notification_idx").on(table.coordinatorId, table.coordinatorNotifiedAt, table.coordinatorAcknowledgedAt),
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

export type UserRole = (typeof userRole.enumValues)[number];
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
