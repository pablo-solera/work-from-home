import { relations } from "drizzle-orm";
import { boolean, type AnyPgColumn, date, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "coordinator", "employee"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("employee"),
  coordinatorId: uuid("coordinator_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  wdNumber: text("wd_number"),
  oracleEmpId: integer("oracle_emp_id").unique(),
  // Identity (name/email) lives in Oracle (TIMERTASK). These fallback fields are
  // only used for system accounts that have no Oracle employee (oracleEmpId null),
  // e.g. the app admin, so they can still log in without depending on Oracle.
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

export type UserRole = (typeof userRole.enumValues)[number];
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
