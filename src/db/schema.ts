import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", ["STUDENT", "ORGANIZER"]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "CONFIRMED",
  "CANCELLED",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "VALID",
  "CHECKED_IN",
  "CANCELLED",
  "EXPIRED",
]);

export const checkInMethodEnum = pgEnum("check_in_method", ["QR_SCAN", "MANUAL"]);

export const emailStatusEnum = pgEnum("email_status", ["SENT", "MOCKED", "FAILED"]);

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("STUDENT"),
    studentId: varchar("student_id", { length: 40 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_unique_idx").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    venue: varchar("venue", { length: 180 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").notNull(),
    category: varchar("category", { length: 60 }).notNull().default("Campus"),
    isPublished: boolean("is_published").notNull().default(true),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("events_starts_at_idx").on(table.startsAt),
    index("events_organizer_idx").on(table.organizerId),
  ],
);

/* ------------------------------------------------------------------ */
/* Registrations  (unique per student + event)                        */
/* ------------------------------------------------------------------ */

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: registrationStatusEnum("status").notNull().default("CONFIRMED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Anti-duplicate registration: one row per (event, student).
    uniqueIndex("registrations_event_user_unique_idx").on(table.eventId, table.userId),
    index("registrations_user_idx").on(table.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Tickets                                                            */
/* ------------------------------------------------------------------ */

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Human readable, globally unique ticket identifier shown on the ticket.
    code: varchar("code", { length: 32 }).notNull(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: ticketStatusEnum("status").notNull().default("VALID"),
    tokenJti: varchar("token_jti", { length: 64 }).notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tickets_code_unique_idx").on(table.code),
    uniqueIndex("tickets_registration_unique_idx").on(table.registrationId),
    index("tickets_event_idx").on(table.eventId),
    index("tickets_user_idx").on(table.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Check-ins  (unique per ticket => anti-duplication at DB level)     */
/* ------------------------------------------------------------------ */

export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scannedById: uuid("scanned_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    method: checkInMethodEnum("method").notNull().default("QR_SCAN"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("check_ins_ticket_unique_idx").on(table.ticketId),
    index("check_ins_event_idx").on(table.eventId),
    index("check_ins_checked_in_at_idx").on(table.checkedInAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Email log (mailer observability + dev mock mode)                   */
/* ------------------------------------------------------------------ */

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toEmail: varchar("to_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 300 }).notNull(),
    status: emailStatusEnum("status").notNull(),
    provider: varchar("provider", { length: 40 }).notNull().default("resend"),
    providerMessageId: varchar("provider_message_id", { length: 180 }),
    error: text("error"),
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    html: text("html"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_logs_ticket_idx").on(table.ticketId)],
);

/* ------------------------------------------------------------------ */
/* Relations / inferred types                                         */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;
export type EmailLog = typeof emailLogs.$inferSelect;
