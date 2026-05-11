export const BOOKING_STATUSES = ["pending", "confirmed", "declined", "completed"];
export const BOOKING_TIME_ZONE = "America/New_York";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

let setupPromise;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: BOOKING_TIME_ZONE
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeZone: "UTC"
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC"
});

export const jsonResponse = (body, status = 200, headers = {}) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...headers
    }
  });
};

export const cleanText = (value, maxLength = 160) => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

export const cleanNotes = (value) => {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);
};

export const cleanMessageBody = (value) => {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 4000);
};

export const isValidStatus = (status) => BOOKING_STATUSES.includes(status);

const parseDateParts = (dateValue) => {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
};

const parseTimeParts = (timeValue) => {
  const match = String(timeValue || "").match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
};

export const formatBookingDateTime = (bookingOrDate, maybeTime) => {
  const dateValue = typeof bookingOrDate === "object" && bookingOrDate
    ? bookingOrDate.date
    : bookingOrDate;
  const timeValue = typeof bookingOrDate === "object" && bookingOrDate
    ? bookingOrDate.time
    : maybeTime;
  const dateParts = parseDateParts(dateValue);
  const timeParts = parseTimeParts(timeValue);

  if (!dateParts) {
    return [dateValue, timeValue].filter(Boolean).join(" at ") || "No time provided";
  }

  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 12));
  const formattedDate = dateFormatter.format(date);

  if (!timeParts) {
    return formattedDate;
  }

  const time = new Date(Date.UTC(2000, 0, 1, timeParts.hour, timeParts.minute));
  return `${formattedDate} at ${timeFormatter.format(time)}`;
};

export const formatTimestamp = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return dateTimeFormatter.format(date);
};

export const getBookingsDatabase = (env) => {
  return env.BOOKINGS_DB || env.DB || null;
};

export const requireBookingsDatabase = (env) => {
  const db = getBookingsDatabase(env);

  if (!db || typeof db.prepare !== "function") {
    throw new Error("Cloudflare D1 binding BOOKINGS_DB is not configured.");
  }

  return db;
};

export const ensureBookingsTable = async (db) => {
  setupPromise ||= db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'completed')),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        service TEXT NOT NULL,
        vehicle TEXT NOT NULL,
        preferred_date TEXT NOT NULL,
        preferred_time TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        notes TEXT,
        consent INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'website'
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS booking_messages (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings (created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_created ON booking_messages (booking_id, created_at ASC)")
  ]).catch((error) => {
    setupPromise = null;
    throw error;
  });

  await setupPromise;
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const makeId = (prefix) => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}_${random}`;
};

const makeBookingId = () => makeId("bk");

const makeMessageId = () => makeId("bm");

export const normalizeBooking = (data) => {
  const booking = {
    id: makeBookingId(),
    status: "pending",
    name: cleanText(data.name, 100),
    email: cleanText(data.email, 160).toLowerCase(),
    phone: cleanText(data.phone, 60),
    service: cleanText(data.service, 120),
    vehicle: cleanText(data.vehicle, 140),
    date: cleanText(data.date, 40),
    time: cleanText(data.time, 40),
    address: cleanText(data.address, 180),
    city: cleanText(data.city, 100),
    notes: cleanNotes(data.notes),
    consent: data.consent === true
      || data.consent === "true"
      || data.consent === "on"
      || data.consent === "1"
  };
  const errors = [];

  if (!booking.name) errors.push("Name is required.");
  if (!isEmail(booking.email)) errors.push("A valid email is required.");
  if (!booking.phone) errors.push("Phone is required.");
  if (!booking.service) errors.push("Service is required.");
  if (!booking.vehicle) errors.push("Vehicle is required.");
  if (!booking.date) errors.push("Preferred date is required.");
  if (!booking.time) errors.push("Preferred time is required.");
  if (!booking.address) errors.push("Street address is required.");
  if (!booking.city) errors.push("City is required.");
  if (!booking.consent) errors.push("Contact consent is required.");

  return { booking, errors };
};

const rowToBooking = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    formattedDateTime: formatBookingDateTime(row.preferred_date, row.preferred_time),
    formattedCreatedAt: formatTimestamp(row.created_at),
    formattedUpdatedAt: formatTimestamp(row.updated_at),
    name: row.name,
    email: row.email,
    phone: row.phone,
    service: row.service,
    vehicle: row.vehicle,
    date: row.preferred_date,
    time: row.preferred_time,
    address: row.address,
    city: row.city,
    notes: row.notes || "",
    consent: Boolean(row.consent),
    source: row.source || "website",
    messages: []
  };
};

const rowToMessage = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    bookingId: row.booking_id,
    direction: row.direction,
    subject: row.subject,
    body: row.body,
    createdAt: row.created_at,
    formattedCreatedAt: formatTimestamp(row.created_at)
  };
};

const attachMessagesToBookings = async (db, bookings) => {
  if (!bookings.length) {
    return bookings;
  }

  const placeholders = bookings.map(() => "?").join(", ");
  const result = await db.prepare(`
    SELECT * FROM booking_messages
    WHERE booking_id IN (${placeholders})
    ORDER BY created_at ASC
  `).bind(...bookings.map((booking) => booking.id)).all();
  const messagesByBooking = new Map();

  for (const row of result.results || []) {
    const message = rowToMessage(row);
    const messages = messagesByBooking.get(message.bookingId) || [];
    messages.push(message);
    messagesByBooking.set(message.bookingId, messages);
  }

  return bookings.map((booking) => ({
    ...booking,
    messages: messagesByBooking.get(booking.id) || []
  }));
};

export const createBooking = async (db, booking) => {
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO bookings (
      id, created_at, updated_at, status, name, email, phone, service, vehicle,
      preferred_date, preferred_time, address, city, notes, consent, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    booking.id,
    now,
    now,
    "pending",
    booking.name,
    booking.email,
    booking.phone,
    booking.service,
    booking.vehicle,
    booking.date,
    booking.time,
    booking.address,
    booking.city,
    booking.notes,
    booking.consent ? 1 : 0,
    "website"
  ).run();

  return {
    ...booking,
    createdAt: now,
    updatedAt: now,
    formattedDateTime: formatBookingDateTime(booking),
    formattedCreatedAt: formatTimestamp(now),
    formattedUpdatedAt: formatTimestamp(now),
    messages: []
  };
};

export const listBookings = async (db, status = "") => {
  const query = isValidStatus(status)
    ? db.prepare("SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC LIMIT 300").bind(status)
    : db.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 300");
  const result = await query.all();
  return attachMessagesToBookings(db, (result.results || []).map(rowToBooking));
};

export const getBooking = async (db, id) => {
  const row = await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first();
  const booking = rowToBooking(row);

  if (!booking) {
    return null;
  }

  const [bookingWithMessages] = await attachMessagesToBookings(db, [booking]);
  return bookingWithMessages;
};

export const updateBookingStatus = async (db, id, status) => {
  const now = new Date().toISOString();

  await db.prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, id)
    .run();

  return getBooking(db, id);
};

export const listBookingMessages = async (db, bookingId) => {
  const result = await db.prepare(`
    SELECT * FROM booking_messages
    WHERE booking_id = ?
    ORDER BY created_at ASC
  `).bind(bookingId).all();
  return (result.results || []).map(rowToMessage);
};

export const normalizeBookingMessage = (data) => {
  const body = cleanMessageBody(data.body || data.message);
  const subject = cleanText(data.subject, 180);
  const errors = [];

  if (!body) {
    errors.push("Message body is required.");
  }

  return {
    message: {
      id: makeMessageId(),
      direction: "outbound",
      subject,
      body
    },
    errors
  };
};

export const createBookingMessage = async (db, bookingId, message) => {
  const now = new Date().toISOString();
  const id = message.id || makeMessageId();

  await db.prepare(`
    INSERT INTO booking_messages (
      id, booking_id, direction, subject, body, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    bookingId,
    message.direction || "outbound",
    message.subject,
    message.body,
    now
  ).run();

  return rowToMessage({
    id,
    booking_id: bookingId,
    direction: message.direction || "outbound",
    subject: message.subject,
    body: message.body,
    created_at: now
  });
};

const getPresentedAdminToken = (request) => {
  const authorization = request.headers.get("Authorization") || "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.headers.get("X-Booking-Admin-Token") || "";
};

const hashToken = async (token) => {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const isAdminRequest = async (request, env) => {
  const expected = env.BOOKING_ADMIN_TOKEN || env.BOOKINGS_ADMIN_TOKEN || env.ADMIN_BOOKINGS_TOKEN || "";
  const presented = getPresentedAdminToken(request);

  if (!expected || !presented) {
    return false;
  }

  const [expectedHash, presentedHash] = await Promise.all([
    hashToken(expected),
    hashToken(presented)
  ]);

  return expectedHash === presentedHash;
};

export const requireAdminRequest = async (request, env) => {
  if (!env.BOOKING_ADMIN_TOKEN && !env.BOOKINGS_ADMIN_TOKEN && !env.ADMIN_BOOKINGS_TOKEN) {
    return jsonResponse({ message: "Booking admin access is not configured." }, 503);
  }

  if (!(await isAdminRequest(request, env))) {
    return jsonResponse({ message: "Unauthorized." }, 401);
  }

  return null;
};
