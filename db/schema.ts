import { relations } from "drizzle-orm";
import { date, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "user"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("user"),
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

export const usersRelations = relations(users, ({ many }) => ({
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
