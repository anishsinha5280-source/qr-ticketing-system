import { z } from "zod";

/** Zod v4 friendly ISO-date string that must be parseable. */
const isoDate = z
  .string()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid date value",
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.email("Enter a valid email address").transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
  studentId: z.string().trim().max(40).optional().or(z.literal("")),
  role: z.enum(["STUDENT", "ORGANIZER"]).default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Password is required").max(200),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  studentId: z.string().trim().max(40).nullable().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const eventFieldsSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(180),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  venue: z.string().trim().min(2, "Venue is required").max(180),
  startsAt: isoDate,
  endsAt: isoDate,
  capacity: z.coerce
    .number({ message: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(100000, "Capacity is too large"),
  category: z.string().trim().max(60).optional(),
  isPublished: z.boolean().optional(),
});

export const createEventSchema = eventFieldsSchema.refine(
  (data) => new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(),
  { message: "End time must be after start time", path: ["endsAt"] },
);

export const updateEventSchema = eventFieldsSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
    path: [],
  });

export const verifyTicketSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Ticket token looks too short")
    .max(4000, "Ticket token looks too long"),
  /** Optional: forces the ticket to belong to the currently selected event. */
  eventId: z.string().uuid("Invalid event id").optional().or(z.literal("")),
  method: z.enum(["QR_SCAN", "MANUAL"]).default("QR_SCAN"),
});

export const attendeesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["ALL", "VALID", "CHECKED_IN"]).default("ALL"),
});

export const checkInsQuerySchema = z.object({
  eventId: z.string().uuid().optional().or(z.literal("")),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type VerifyTicketInput = z.infer<typeof verifyTicketSchema>;
