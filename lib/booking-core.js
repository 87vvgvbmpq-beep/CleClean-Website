export const BOOKING_STATUSES = ["pending", "confirmed", "declined", "completed"];

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

let setupPromise;

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

export const isValidStatus = (status) => BOOKING_STATUSES.includes(status);

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
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings (created_at DESC)")
  ]).catch((error) => {
    setupPromise = null;
    throw error;
  });

  await setupPromise;
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const makeBookingId = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `bk_${Date.now().toString(36)}_${random}`;
};

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
    source: row.source || "website"
  };
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
    updatedAt: now
  };
};

export const listBookings = async (db, status = "") => {
  const query = isValidStatus(status)
    ? db.prepare("SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC LIMIT 300").bind(status)
    : db.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 300");
  const result = await query.all();
  return (result.results || []).map(rowToBooking);
};

export const getBooking = async (db, id) => {
  const row = await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first();
  return rowToBooking(row);
};

export const updateBookingStatus = async (db, id, status) => {
  const now = new Date().toISOString();

  await db.prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, id)
    .run();

  return getBooking(db, id);
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
