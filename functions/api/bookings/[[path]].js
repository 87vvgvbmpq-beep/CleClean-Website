import {
  createBookingMessage,
  ensureBookingsTable,
  getBooking,
  isValidStatus,
  jsonResponse,
  listBookings,
  normalizeBookingMessage,
  requireAdminRequest,
  requireBookingsDatabase,
  updateBookingStatus
} from "../../../lib/booking-core.js";
import {
  makeCustomerMessageSubject,
  sendCustomerMessageEmail,
  sendCustomerStatusEmail
} from "../../../lib/resend.js";

const adminHeaders = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Booking-Admin-Token",
  "Access-Control-Allow-Methods": "GET, PATCH, POST, OPTIONS"
};

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const getRouteParts = (params) => {
  const path = params?.path;
  return Array.isArray(path)
    ? path
    : String(path || "").split("/").filter(Boolean);
};

const listHandler = async (request, env) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";

  if (status && !isValidStatus(status)) {
    return jsonResponse({ message: "Invalid booking status." }, 400, adminHeaders);
  }

  const db = requireBookingsDatabase(env);
  await ensureBookingsTable(db);
  const bookings = await listBookings(db, status);
  return jsonResponse({ bookings }, 200, adminHeaders);
};

const patchHandler = async (request, env, id) => {
  if (!id) {
    return jsonResponse({ message: "Booking id is required." }, 400, adminHeaders);
  }

  const body = await readJson(request);
  const nextStatus = String(body.status || "").trim().toLowerCase();

  if (!isValidStatus(nextStatus)) {
    return jsonResponse({ message: "Invalid booking status." }, 400, adminHeaders);
  }

  if ((nextStatus === "confirmed" || nextStatus === "declined") && !env.RESEND_API_KEY) {
    return jsonResponse({ message: "RESEND_API_KEY is required before confirming or declining bookings." }, 503, adminHeaders);
  }

  const db = requireBookingsDatabase(env);
  await ensureBookingsTable(db);
  const existingBooking = await getBooking(db, id);

  if (!existingBooking) {
    return jsonResponse({ message: "Booking not found." }, 404, adminHeaders);
  }

  const booking = await updateBookingStatus(db, id, nextStatus);

  if (nextStatus === "confirmed" || nextStatus === "declined") {
    await sendCustomerStatusEmail(env, booking, nextStatus);
  }

  return jsonResponse({ booking }, 200, adminHeaders);
};

const messageHandler = async (request, env, id) => {
  if (!id) {
    return jsonResponse({ message: "Booking id is required." }, 400, adminHeaders);
  }

  if (!env.RESEND_API_KEY) {
    return jsonResponse({ message: "RESEND_API_KEY is required before sending customer messages." }, 503, adminHeaders);
  }

  const body = await readJson(request);
  const { message, errors } = normalizeBookingMessage(body);

  if (errors.length) {
    return jsonResponse({ message: errors.join(" ") }, 400, adminHeaders);
  }

  const db = requireBookingsDatabase(env);
  await ensureBookingsTable(db);
  const booking = await getBooking(db, id);

  if (!booking) {
    return jsonResponse({ message: "Booking not found." }, 404, adminHeaders);
  }

  message.subject = message.subject || makeCustomerMessageSubject(booking);
  await sendCustomerMessageEmail(env, booking, message);
  const savedMessage = await createBookingMessage(db, id, message);
  const updatedBooking = await getBooking(db, id);

  return jsonResponse({
    message: savedMessage,
    booking: updatedBooking
  }, 200, adminHeaders);
};

export const onRequest = async ({ request, env, params }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: adminHeaders
    });
  }

  const authResponse = await requireAdminRequest(request, env);

  if (authResponse) {
    return authResponse;
  }

  try {
    const routeParts = getRouteParts(params);
    const routeId = routeParts[0] || "";
    const routeAction = routeParts[1] || "";

    if (request.method === "GET") {
      return listHandler(request, env);
    }

    if (request.method === "PATCH" && !routeAction) {
      return patchHandler(request, env, routeId);
    }

    if (request.method === "POST" && routeAction === "messages") {
      return messageHandler(request, env, routeId);
    }

    return jsonResponse({ message: "Method not allowed." }, 405, adminHeaders);
  } catch (error) {
    console.error(error);
    if (String(error?.message || "").includes("BOOKINGS_DB")) {
      return jsonResponse({ message: "Cloudflare D1 binding BOOKINGS_DB is not configured." }, 503, adminHeaders);
    }

    return jsonResponse({ message: "Booking admin request failed." }, 500, adminHeaders);
  }
};
