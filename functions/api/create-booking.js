import {
  cleanText,
  createBooking,
  ensureBookingsTable,
  jsonResponse,
  normalizeBooking,
  requireBookingsDatabase
} from "../../lib/booking-core.js";
import { sendNewBookingEmails } from "../../lib/resend.js";

const publicHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

const readRequestData = async (request) => {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    return Object.fromEntries(new URLSearchParams(body));
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  return {};
};

const handleBookingRequest = async (request, env) => {
  const data = await readRequestData(request);

  if (cleanText(data.company)) {
    return jsonResponse({
      message: "Booking request sent. We will follow up to confirm the appointment."
    }, 200, publicHeaders);
  }

  const { booking, errors } = normalizeBooking(data);

  if (errors.length) {
    return jsonResponse({ message: errors.join(" ") }, 400, publicHeaders);
  }

  const db = requireBookingsDatabase(env);
  await ensureBookingsTable(db);
  const savedBooking = await createBooking(db, booking);

  try {
    await sendNewBookingEmails(env, savedBooking);
  } catch (error) {
    console.error(error);
  }

  return jsonResponse({
    bookingId: savedBooking.id,
    message: "Booking request sent. We will follow up to confirm the appointment."
  }, 200, publicHeaders);
};

export const onRequest = async ({ request, env }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: publicHeaders
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "Method not allowed." }, 405, publicHeaders);
  }

  try {
    return await handleBookingRequest(request, env);
  } catch (error) {
    console.error(error);
    if (String(error?.message || "").includes("BOOKINGS_DB")) {
      return jsonResponse({
        message: "Online booking storage is not configured yet. Please call or email us directly."
      }, 503, publicHeaders);
    }

    return jsonResponse({
      message: "Booking request could not be completed. Please call or email us directly."
    }, 500, publicHeaders);
  }
};
