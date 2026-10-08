import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { checkIns, events, registrations, tickets, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import {
  computeTokenExpiry,
  generateTicketCode,
  newTokenJti,
} from "@/lib/ticket-token";

/**
 * Demo data.
 *
 * ⚠️ DEVELOPMENT ONLY — these credentials are published in the README and must
 * never be used in a real deployment.
 */
export const DEMO_CREDENTIALS = {
  student: { email: "student@example.com", password: "Student@123" },
  organizer: { email: "organizer@example.com", password: "Organizer@123" },
} as const;

/** Builds a Date N days from today at a fixed UTC clock time. */
function at(dayOffset: number, hour: number, minute = 0): Date {
  const base = new Date();
  base.setUTCHours(hour, minute, 0, 0);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return base;
}

type SeedEventInput = {
  key: string;
  title: string;
  description: string;
  venue: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  category: string;
};

export async function ensureSeed(options: { force?: boolean } = {}): Promise<{
  seeded: boolean;
  reason?: string;
}> {
  const [userRow] = await db.select({ total: count() }).from(users);
  const userCount = Number(userRow?.total ?? 0);
  if (userCount > 0 && !options.force) {
    return { seeded: false, reason: "database already contains data" };
  }

  console.info("[seed] inserting demo data (development credentials)…");

  const passwordHash = await hashPassword("Student@123");
  const organizerHash = await hashPassword("Organizer@123");

  const organizer = (
    await db
      .insert(users)
      .values({
        name: "Prof. Anita Desai",
        email: DEMO_CREDENTIALS.organizer.email,
        passwordHash: organizerHash,
        role: "ORGANIZER",
      })
      .returning()
  )[0]!;

  const studentDefs = [
    { name: "Aarav Sharma", email: DEMO_CREDENTIALS.student.email, studentId: "CS21B1001" },
    { name: "Riya Nair", email: "riya@campus.edu", studentId: "EC21B2044" },
    { name: "Arjun Mehta", email: "arjun@campus.edu", studentId: "CS22B1077" },
    { name: "Meera Iyer", email: "meera@campus.edu", studentId: "ME20B3012" },
  ];

  const students: (typeof users.$inferSelect)[] = [];
  for (const def of studentDefs) {
    const row = (
      await db
        .insert(users)
        .values({
          name: def.name,
          email: def.email,
          passwordHash,
          role: "STUDENT",
          studentId: def.studentId,
        })
        .returning()
    )[0]!;
    students.push(row);
  }
  const [aarav, riya, arjun, meera] = students;

  const eventDefs: SeedEventInput[] = [
    {
      key: "aws",
      title: "AWS Cloud Career Kickoff",
      description:
        "A hands-on session with AWS Student Ambassadors covering cloud career paths, free-tier projects, certification roadmaps and the AWS Educate programme. Bring a laptop — you will deploy your first containerised app live.",
      venue: "Main Auditorium, Block A",
      startsAt: at(2, 15),
      endsAt: at(2, 17, 30),
      capacity: 250,
      category: "Career",
    },
    {
      key: "hacknight",
      title: "HackNight 2026 — 12 Hour Build Sprint",
      description:
        "Teams of up to four build a working prototype overnight. Mentors from the CS department and local startups circulate all night, with pizza at 22:00 and demo judging at 07:00. Winners get cloud credits and an incubation interview.",
      venue: "Innovation Lab, CS Block",
      startsAt: at(5, 18),
      endsAt: at(6, 6),
      capacity: 80,
      category: "Hackathon",
    },
    {
      key: "aiml",
      title: "AI & ML Hands-On Workshop",
      description:
        "From linear regression to fine-tuning a transformer: a compact workshop with notebooks provided. Limited seats so every participant gets mentor attention. Prerequisites: Python basics and high-school calculus.",
      venue: "Seminar Hall 3, Block C",
      startsAt: at(3, 10),
      endsAt: at(3, 13),
      capacity: 40,
      category: "Workshop",
    },
    {
      key: "cultural",
      title: "Cultural Night: Raag & Rhythm",
      description:
        "The annual music and dance showcase featuring student bands, a classical fusion set and a finale by the campus orchestra. Food stalls open from 18:00 in the amphitheatre lawn.",
      venue: "Open Air Theatre",
      startsAt: at(9, 18, 30),
      endsAt: at(9, 21, 30),
      capacity: 400,
      category: "Cultural",
    },
    {
      key: "pitch",
      title: "Startup Pitch Arena",
      description:
        "Twelve student startups pitch to a panel of angel investors and the E-Cell incubation board. Five minutes on stage, three minutes of questions, live scoring by the jury.",
      venue: "Incubation Centre, E-Cell",
      startsAt: at(12, 14),
      endsAt: at(12, 17),
      capacity: 60,
      category: "Entrepreneurship",
    },
    {
      key: "k8s",
      title: "Intro to Kubernetes (CNCF Study Jam)",
      description:
        "A tiny, focused study jam on pods, deployments and services using a local cluster. Only 2 seats in the lab — perfect for testing capacity limits and the EVENT FULL flow.",
      venue: "Computer Lab 2, Block B",
      startsAt: at(1, 11),
      endsAt: at(1, 13),
      capacity: 2,
      category: "Workshop",
    },
  ];

  const createdEvents = new Map<string, (typeof events.$inferSelect)[]>();
  for (const def of eventDefs) {
    const rows = await db
      .insert(events)
      .values({
        title: def.title,
        description: def.description,
        venue: def.venue,
        startsAt: def.startsAt,
        endsAt: def.endsAt,
        capacity: def.capacity,
        category: def.category,
        organizerId: organizer.id,
      })
      .returning();
    createdEvents.set(def.key, rows);
  }

  const eventOf = (key: string) => createdEvents.get(key)![0]!;

  // Kubernetes jam is intentionally sold out (capacity = 2) to demo EVENT FULL.
  await issueTicket(eventOf("k8s"), riya);
  await issueTicket(eventOf("k8s"), arjun);

  // AI/ML workshop: demo student registered, one attendee already checked in.
  const aaravTicket = await issueTicket(eventOf("aiml"), aarav!);
  const meeraTicket = await issueTicket(eventOf("aiml"), meera!);
  await markCheckedIn(meeraTicket!, eventOf("aiml"), meera!, organizer.id);

  // AWS keynote: a healthy attendee list.
  await issueTicket(eventOf("aws"), riya!);
  await issueTicket(eventOf("aws"), meera!);
  const arjunAws = await issueTicket(eventOf("aws"), arjun!);
  await markCheckedIn(arjunAws!, eventOf("aws"), arjun!, organizer.id);

  // Cultural night: one registration so far.
  await issueTicket(eventOf("cultural"), aarav!);

  console.info(
    `[seed] done — student: ${DEMO_CREDENTIALS.student.email} / Student@123 · organizer: ${DEMO_CREDENTIALS.organizer.email} / Organizer@123`,
  );

  return { seeded: true };
}

async function issueTicket(event: typeof events.$inferSelect, student: typeof users.$inferSelect) {
  const registration = (
    await db
      .insert(registrations)
      .values({ eventId: event.id, userId: student.id, status: "CONFIRMED" })
      .returning()
  )[0]!;

  const expiresAt = computeTokenExpiry(event.endsAt);
  const ticket = (
    await db
      .insert(tickets)
      .values({
        code: generateTicketCode(),
        registrationId: registration.id,
        eventId: event.id,
        userId: student.id,
        status: "VALID",
        tokenJti: newTokenJti(),
        tokenExpiresAt: expiresAt,
      })
      .returning()
  )[0]!;

  return ticket;
}

async function markCheckedIn(
  ticket: typeof tickets.$inferSelect,
  event: typeof events.$inferSelect,
  student: typeof users.$inferSelect,
  scannerId: string,
) {
  const now = new Date(Date.now() - 1000 * 60 * 45); // 45 minutes ago
  await db
    .update(tickets)
    .set({ status: "CHECKED_IN", checkedInAt: now })
    .where(eq(tickets.id, ticket.id));
  await db.insert(checkIns).values({
    ticketId: ticket.id,
    eventId: event.id,
    userId: student.id,
    scannedById: scannerId,
    method: "QR_SCAN",
    checkedInAt: now,
  });
}
