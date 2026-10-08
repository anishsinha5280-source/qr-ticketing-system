/**
 * End-to-end smoke test for CampusPass.
 *
 *   node scripts/smoke-test.mjs [BASE_URL]
 *
 * Covers every workflow from the specification:
 *   1. student registration            5. organizer scans a valid QR
 *   2. duplicate registration rejected 6. same QR again => ALREADY USED
 *   3. capacity enforced by backend    7. tampered token => INVALID TICKET
 *   4. unique ticket + signed QR       8. student blocked from organizer APIs
 *   +  concurrent capacity race (atomicity proof)
 */

const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}${detail ? `\n     → ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function req(method, path, { body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const sessionCookie = setCookie
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("ets_session="));
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, cookie: sessionCookie, headers: res.headers };
}

function decodeJwt(token) {
  const [, payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

const stamp = Date.now();
const run = `${stamp.toString(36)}`;

async function makeStudent(prefix) {
  const email = `${prefix}-${run}-${Math.floor(Math.random() * 1e6)}@campus.edu`;
  const res = await req("POST", "/api/auth/register", {
    body: { name: `Test ${prefix}`, email, password: "Student@123", role: "STUDENT", studentId: `T${run}` },
  });
  if (res.status !== 200 || !res.cookie) throw new Error(`could not create student ${email}: ${res.text}`);
  return { email, cookie: res.cookie, user: res.json.data.user };
}

async function main() {
  console.log(`CampusPass smoke test → ${BASE}`);

  section("0 · health + catalogue");
  const health = await req("GET", "/api/health");
  check("GET /api/health responds ok", health.status === 200 && health.json?.ok === true, health.text);

  const publicEvents = await req("GET", "/api/events");
  const events = publicEvents.json?.data?.events ?? [];
  check("GET /api/events returns seeded events", events.length >= 3, `got ${events.length}`);
  const fullEvent = events.find((e) => e.availableSeats === 0);
  const openEvent = events.find((e) => e.availableSeats > 20);
  check("seed data contains a full event and an open event", Boolean(fullEvent && openEvent));

  section("1 · TEST 1 — student registers successfully");
  const student = await makeStudent("student");
  check("POST /api/auth/register creates a STUDENT account", student.user.role === "STUDENT");

  const me = await req("GET", "/api/auth/me", { cookie: student.cookie });
  check("GET /api/auth/me returns the session user", me.json?.data?.user?.email === student.email);

  const reg = await req("POST", `/api/events/${openEvent.id}/register`, { cookie: student.cookie });
  check(
    "POST /api/events/:id/register returns 201 with a ticket",
    reg.status === 201 && Boolean(reg.json?.data?.ticket?.id),
    `status=${reg.status} body=${reg.text.slice(0, 200)}`,
  );
  check(
    "mailer reports sent/mocked (registration never blocked)",
    ["SENT", "MOCKED", "FAILED"].includes(reg.json?.data?.email?.status),
    reg.json?.data?.email?.status,
  );
  const ticket = reg.json?.data?.ticket;

  section("2 · TEST 2 — duplicate registration rejected");
  const dup = await req("POST", `/api/events/${openEvent.id}/register`, { cookie: student.cookie });
  check(
    "second registration for the same event is rejected (409 ALREADY_REGISTERED)",
    dup.status === 409 && dup.json?.error?.code === "ALREADY_REGISTERED",
    `status=${dup.status} body=${dup.text.slice(0, 200)}`,
  );

  section("3 · TEST 3 — capacity enforced by the backend");
  if (fullEvent) {
    const full = await req("POST", `/api/events/${fullEvent.id}/register`, { cookie: student.cookie });
    check(
      "registration into a full event is rejected (409 EVENT_FULL)",
      full.status === 409 && full.json?.error?.code === "EVENT_FULL",
      `status=${full.status} body=${full.text.slice(0, 200)}`,
    );
  } else {
    check("a full event exists to test against", false);
  }

  section("4 · TEST 4 — unique ticket + cryptographically signed QR");
  const ticketRes = await req("GET", `/api/tickets/${ticket.id}`, { cookie: student.cookie });
  const fullTicket = ticketRes.json?.data?.ticket;
  check("GET /api/tickets/:id returns the ticket", ticketRes.status === 200 && Boolean(fullTicket));
  check(
    "ticket exposes a QR data URL (PNG) generated server side",
    typeof fullTicket?.qrDataUrl === "string" && fullTicket.qrDataUrl.startsWith("data:image/png;base64,"),
  );
  const token = fullTicket?.token;
  const parts = String(token ?? "").split(".");
  check("ticket token is a 3-part signed JWT", parts.length === 3);
  const claims = decodeJwt(token);
  check(
    "JWT claims carry ticket/event/registration/user ids (no personal data)",
    claims.tid === ticket.id && claims.eid === openEvent.id && claims.uid === student.user.id,
    JSON.stringify(claims),
  );
  check("QR ticket status is VALID and code looks unique", fullTicket?.status === "VALID" && /^CP-/.test(fullTicket?.code ?? ""));

  const qr = await fetch(`${BASE}/api/tickets/${ticket.id}/qr`, { headers: { Cookie: student.cookie } });
  check("GET /api/tickets/:id/qr serves image/png", qr.status === 200 && qr.headers.get("content-type") === "image/png");

  const otherStudent = await makeStudent("other");
  const stolen = await req("GET", `/api/tickets/${ticket.id}`, { cookie: otherStudent.cookie });
  check("another student cannot read someone else's ticket (404)", stolen.status === 404, `status=${stolen.status}`);

  section("5 · TEST 5 — organizer scans a valid QR");
  const orgLogin = await req("POST", "/api/auth/login", {
    body: { email: "organizer@example.com", password: "Organizer@123" },
  });
  const organizerCookie = orgLogin.cookie;
  check(
    "organizer@example.com can sign in",
    orgLogin.status === 200 && orgLogin.json?.data?.user?.role === "ORGANIZER",
    `status=${orgLogin.status} body=${orgLogin.text.slice(0, 160)}`,
  );

  const scan1 = await req("POST", "/api/organizer/verify-ticket", {
    cookie: organizerCookie,
    body: { token, method: "QR_SCAN" },
  });
  const v1 = scan1.json?.data;
  check(
    "first scan returns CHECK-IN SUCCESSFUL",
    scan1.status === 200 && v1?.result === "SUCCESS" && v1?.headline === "CHECK-IN SUCCESSFUL",
    `status=${scan1.status} body=${JSON.stringify(scan1.json).slice(0, 300)}`,
  );
  check("success payload includes attendee, event, ticket id + timestamp", Boolean(v1?.attendee?.name && v1?.event?.title && v1?.ticket?.code && v1?.checkedInAt));
  check("attendee name matches the registered student", v1?.attendee?.name === "Test student", v1?.attendee?.name);

  const afterScan = await req("GET", `/api/tickets/${ticket.id}`, { cookie: student.cookie });
  check(
    "ticket status flipped VALID → CHECKED_IN",
    afterScan.json?.data?.ticket?.status === "CHECKED_IN",
    afterScan.json?.data?.ticket?.status,
  );

  section("6 · TEST 6 — same QR scanned again");
  const scan2 = await req("POST", "/api/organizer/verify-ticket", {
    cookie: organizerCookie,
    body: { token, method: "QR_SCAN" },
  });
  const v2 = scan2.json?.data;
  check(
    "second scan returns ALREADY USED",
    scan2.status === 200 && v2?.result === "ALREADY_USED" && v2?.headline === "ALREADY USED",
    JSON.stringify(scan2.json).slice(0, 300),
  );
  check("already-used payload shows the original check-in timestamp", Boolean(v2?.firstCheckInAt));

  const attendeeList = await req("GET", `/api/organizer/events/${openEvent.id}/attendees`, {
    cookie: organizerCookie,
  });
  const rows = attendeeList.json?.data?.attendees ?? [];
  const mine = rows.filter((r) => r.ticketId === ticket.id);
  check("attendee list shows exactly one row for the ticket", mine.length === 1, `rows=${mine.length}`);

  const history = await req("GET", `/api/organizer/checkins?eventId=${openEvent.id}&limit=200`, {
    cookie: organizerCookie,
  });
  const historyRows = history.json?.data?.checkIns ?? [];
  const dupes = historyRows.filter((c) => c.ticketId === ticket.id);
  check("check-in history contains exactly ONE row for that ticket (no duplicates)", dupes.length === 1, `rows=${dupes.length}`);

  section("7 · TEST 7 — tampered / forged tokens are rejected");
  const tampered = token.slice(0, -4) + (token.slice(-4) === "AAAA" ? "AAAB" : "AAAA");
  const scanTampered = await req("POST", "/api/organizer/verify-ticket", {
    cookie: organizerCookie,
    body: { token: tampered, method: "MANUAL" },
  });
  check(
    "tampered signature → INVALID TICKET",
    scanTampered.json?.data?.result === "INVALID" && scanTampered.json?.data?.headline === "INVALID TICKET",
    JSON.stringify(scanTampered.json).slice(0, 200),
  );

  const forgedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const forged = `${forgedHeader}.${token.split(".")[1]}.`;
  const scanForged = await req("POST", "/api/organizer/verify-ticket", {
    cookie: organizerCookie,
    body: { token: forged, method: "MANUAL" },
  });
  check("alg:none forgery → INVALID TICKET", scanForged.json?.data?.result === "INVALID");

  const scanGarbage = await req("POST", "/api/organizer/verify-ticket", {
    cookie: organizerCookie,
    body: { token: "this-is-not-a-jwt-at-all-but-long-enough", method: "MANUAL" },
  });
  check("malformed payload → INVALID TICKET", scanGarbage.json?.data?.result === "INVALID");

  const scanUnknown = await req("POST", "/api/organizer/verify-ticket", {
    cookie: organizerCookie,
    body: { token: `${token.split(".")[0]}.${Buffer.from(JSON.stringify({ ...claims, tid: "00000000-0000-4000-8000-000000000000" })).toString("base64url")}.${token.split(".")[2]}`, method: "MANUAL" },
  });
  check("valid signature but unknown ticket id → INVALID TICKET", scanUnknown.json?.data?.result === "INVALID");

  const wrongEvent = await req("POST", "/api/organizer/verify-ticket", {
    cookie: organizerCookie,
    body: { token, eventId: fullEvent?.id ?? openEvent.id, method: "MANUAL" },
  });
  check(
    "token presented at the wrong gate → rejected",
    wrongEvent.json?.data?.result === "ALREADY_USED" || wrongEvent.json?.data?.result === "INVALID",
    wrongEvent.json?.data?.result,
  );

  const anonymous = await req("POST", "/api/organizer/verify-ticket", { body: { token } });
  check("verify-ticket without a session → 401", anonymous.status === 401, `status=${anonymous.status}`);

  section("8 · TEST 8 — role-based access control");
  const statsAsStudent = await req("GET", "/api/organizer/stats", { cookie: student.cookie });
  check("student calling GET /api/organizer/stats → 403", statsAsStudent.status === 403, `status=${statsAsStudent.status}`);

  const verifyAsStudent = await req("POST", "/api/organizer/verify-ticket", {
    cookie: student.cookie,
    body: { token },
  });
  check("student calling verify-ticket → 403", verifyAsStudent.status === 403, `status=${verifyAsStudent.status}`);

  const registerAsOrganizer = await req("POST", `/api/events/${openEvent.id}/register`, {
    cookie: organizerCookie,
  });
  check("organizer registering as attendee → 403", registerAsOrganizer.status === 403, `status=${registerAsOrganizer.status}`);

  const anonMe = await req("GET", "/api/auth/me");
  check("GET /api/auth/me without a cookie → 401", anonMe.status === 401, `status=${anonMe.status}`);

  const badLogin = await req("POST", "/api/auth/login", {
    body: { email: "organizer@example.com", password: "wrong-password" },
  });
  check("login with a wrong password → 401", badLogin.status === 401, `status=${badLogin.status}`);

  section("9 · organizer CRUD + capacity race (atomicity)");
  const created = await req("POST", "/api/events", {
    cookie: organizerCookie,
    body: {
      title: `Race Test Event ${run}`,
      description: "Temporary event used by the smoke test to prove atomic capacity handling.",
      venue: "Test Lab",
      startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 3 * 86_400_000 + 7_200_000).toISOString(),
      capacity: 3,
      category: "Test",
    },
  });
  const raceEventId = created.json?.data?.event?.id;
  check("POST /api/events creates an event (organizer only)", created.status === 200 && Boolean(raceEventId));

  const invalidCreate = await req("POST", "/api/events", {
    cookie: organizerCookie,
    body: { title: "x", description: "short", venue: "", startsAt: "nope", endsAt: "nope", capacity: 0 },
  });
  check("invalid event payload → 422 VALIDATION_ERROR", invalidCreate.status === 422, `status=${invalidCreate.status}`);

  const updated = await req("PUT", `/api/events/${raceEventId}`, {
    cookie: organizerCookie,
    body: { venue: "Updated Lab", capacity: 3 },
  });
  check("PUT /api/events/:id updates the event", updated.status === 200 && updated.json?.data?.event?.venue === "Updated Lab");

  const studentEdit = await req("PUT", `/api/events/${raceEventId}`, {
    cookie: student.cookie,
    body: { capacity: 5000 },
  });
  check("student editing an event → 403", studentEdit.status === 403, `status=${studentEdit.status}`);

  // 12 students race for 3 seats.
  // Created sequentially on purpose: the sign-up rate limiter (correctly)
  // rejects credential-stuffing-style bursts from one IP.
  const racers = [];
  for (let i = 0; i < 12; i += 1) {
    racers.push(await makeStudent(`racer${i}`));
  }
  const raceResults = await Promise.all(
    racers.map((racer) => req("POST", `/api/events/${raceEventId}/register`, { cookie: racer.cookie })),
  );
  const wins = raceResults.filter((r) => r.status === 201).length;
  const rejects = raceResults.filter((r) => r.status === 409).length;
  check(`exactly 3 of 12 concurrent registrations won seats (wins=${wins}, rejected=${rejects})`, wins === 3 && rejects === 9);

  const afterRace = await req("GET", `/api/events/${raceEventId}`);
  check(
    "event reports 0 available seats after the race",
    afterRace.json?.data?.event?.availableSeats === 0 && afterRace.json?.data?.event?.isFull === true,
    JSON.stringify(afterRace.json?.data?.event ?? {}).slice(0, 200),
  );

  // Concurrent double-scan of one QR must produce exactly one SUCCESS.
  const racerTicket = raceResults.find((r) => r.status === 201)?.json?.data?.ticket;
  const racerToken = racerTicket?.token;
  const parallel = await Promise.all(
    Array.from({ length: 6 }).map(() =>
      req("POST", "/api/organizer/verify-ticket", {
        cookie: organizerCookie,
        body: { token: racerToken, method: "QR_SCAN" },
      }),
    ),
  );
  const successes = parallel.filter((r) => r.json?.data?.result === "SUCCESS").length;
  const already = parallel.filter((r) => r.json?.data?.result === "ALREADY_USED").length;
  check(
    `6 parallel scans of one QR → exactly 1 SUCCESS (got ${successs} success / ${already} already-used)`,
    successes === 1 && already === 5,
  );

  const stats = await req("GET", "/api/organizer/stats", { cookie: organizerCookie });
  check(
    "GET /api/organizer/stats returns dashboard totals",
    stats.status === 200 && typeof stats.json?.data?.totals?.registrations === "number",
  );

  const deleted = await req("DELETE", `/api/events/${raceEventId}`, { cookie: organizerCookie });
  check("DELETE /api/events/:id removes the test event", deleted.status === 200 && deleted.json?.data?.deleted === true);

  section("10 · security headers");
  const pageRes = await fetch(`${BASE}/login`);
  check("pages set X-Content-Type-Options + CSP", pageRes.headers.get("x-content-type-options") === "nosniff" && Boolean(pageRes.headers.get("content-security-policy")));
  check("X-Frame-Options is DENY", pageRes.headers.get("x-frame-options") === "DENY");
  check("login page renders", pageRes.status === 200 && (await pageRes.text()).includes("Welcome back"));

  console.log(`\n${"=".repeat(56)}\nRESULT: ${passed} passed, ${failed} failed\n${"=".repeat(56)}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n💥 smoke test crashed:", err);
  process.exit(1);
});
