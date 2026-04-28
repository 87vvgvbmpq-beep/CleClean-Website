import { getStore } from "@netlify/blobs";

export const BUSINESS_NAME = "Cleveland Clean Car Detailing & Ceramics LLC";
export const BUSINESS_PHONE = "(216) 659-1510";
export const BUSINESS_EMAIL = "clecleandetailing@gmail.com";
export const BUSINESS_REVIEW_URL = "https://maps.app.goo.gl/yiJsZHE4osp62iV49";
export const DEFAULT_TIME_ZONE = "America/New_York";

const EMAIL_ENDPOINT = "https://api.resend.com/emails";
const BOOKING_PREFIX = "bookings/";
const MAX_TEXT_LENGTH = 1200;

export const bookingKey = (id) => `${BOOKING_PREFIX}${id}.json`;

export const getBookingStore = () => {
  return getStore(process.env.BOOKING_STORE_NAME || "cleclean-bookings");
};

export const jsonResponse = (body, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
};

export const htmlResponse = (html, status = 200) => {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};

export const readRequestData = async (request) => {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  const text = await request.text();

  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
};

const cleanText = (value, maxLength = 180) => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

const cleanLongText = (value) => {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isPhone = (value) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};

const getZoneParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
};

const getTimeZoneOffset = (date, timeZone) => {
  const parts = getZoneParts(date, timeZone);
  const zoneAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return zoneAsUtc - date.getTime();
};

export const zonedTimeToUtc = (dateValue, timeValue, timeZone = DEFAULT_TIME_ZONE) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = localAsUtc - getTimeZoneOffset(new Date(localAsUtc), timeZone);
  utc = localAsUtc - getTimeZoneOffset(new Date(utc), timeZone);

  return new Date(utc);
};

export const formatAppointment = (booking) => {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: booking.appointment.timeZone || DEFAULT_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(booking.appointment.startsAt));
};

export const normalizeBooking = (data) => {
  const errors = [];
  const timeZone = process.env.BOOKING_TIME_ZONE || DEFAULT_TIME_ZONE;
  const appointmentAt = zonedTimeToUtc(cleanText(data.date, 12), cleanText(data.time, 8), timeZone);
  const consent = data.consent === true || data.consent === "true" || data.consent === "on";
  const customer = {
    name: cleanText(data.name, 120),
    email: cleanText(data.email, 180).toLowerCase(),
    phone: cleanText(data.phone, 40)
  };
  const booking = {
    service: cleanText(data.service, 120),
    vehicle: cleanText(data.vehicle, 160),
    address: {
      street: cleanText(data.address, 180),
      city: cleanText(data.city || "Cleveland", 100)
    },
    notes: cleanLongText(data.notes),
    appointment: {
      date: cleanText(data.date, 12),
      time: cleanText(data.time, 8),
      timeZone,
      startsAt: appointmentAt ? appointmentAt.toISOString() : null
    },
    customer
  };

  if (!customer.name) errors.push("Name is required.");
  if (!isEmail(customer.email)) errors.push("A valid email is required.");
  if (!isPhone(customer.phone)) errors.push("A valid phone number is required.");
  if (!booking.service) errors.push("Please choose a service.");
  if (!booking.vehicle) errors.push("Vehicle details are required.");
  if (!booking.address.street) errors.push("Street address is required.");
  if (!appointmentAt || Number.isNaN(appointmentAt.getTime())) errors.push("A valid appointment date and time is required.");
  if (appointmentAt && appointmentAt.getTime() <= Date.now()) errors.push("Please choose a future appointment time.");
  if (!consent) errors.push("Please agree to be contacted about this booking.");

  return { booking, errors };
};

export const splitEmails = (value, fallback = "") => {
  return String(value || fallback)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
};

export const getAdminEmails = () => {
  return splitEmails(process.env.BOOKING_ADMIN_EMAILS, BUSINESS_EMAIL);
};

export const getReplyToEmail = () => {
  return process.env.BOOKING_REPLY_TO_EMAIL || getAdminEmails()[0] || BUSINESS_EMAIL;
};

export const requireEmailConfig = () => {
  const missing = [];

  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.BOOKING_FROM_EMAIL) missing.push("BOOKING_FROM_EMAIL");
  if (getAdminEmails().length === 0) missing.push("BOOKING_ADMIN_EMAILS");

  if (missing.length) {
    throw new Error(`Booking email automation is missing: ${missing.join(", ")}`);
  }
};

export const escapeHtml = (value) => {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[character];
  });
};

const detailRows = (booking) => {
  return [
    ["Service", booking.service],
    ["Appointment", formatAppointment(booking)],
    ["Vehicle", booking.vehicle],
    ["Name", booking.customer.name],
    ["Email", booking.customer.email],
    ["Phone", booking.customer.phone],
    ["Address", `${booking.address.street}, ${booking.address.city}`],
    ["Notes", booking.notes || "None"]
  ];
};

const emailLayout = (title, content) => {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.55; color: #101317; max-width: 680px;">
      <h1 style="margin: 0 0 16px; color: #103b30; font-size: 28px;">${escapeHtml(title)}</h1>
      ${content}
      <p style="margin: 28px 0 0; color: #5b6470;">${escapeHtml(BUSINESS_NAME)}<br>${escapeHtml(BUSINESS_PHONE)}</p>
    </div>
  `;
};

const detailsHtml = (booking) => {
  const rows = detailRows(booking)
    .map(([label, value]) => `<tr><th style="text-align:left; padding:8px 12px; background:#f6f7f2; width:150px;">${escapeHtml(label)}</th><td style="padding:8px 12px;">${escapeHtml(value)}</td></tr>`)
    .join("");

  return `<table style="border-collapse: collapse; border: 1px solid #d8ddd7; width: 100%;">${rows}</table>`;
};

const detailsText = (booking) => {
  return detailRows(booking).map(([label, value]) => `${label}: ${value}`).join("\n");
};

export const baseUrlFromRequest = (request) => {
  const configured = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

export const manageBookingUrl = (baseUrl, booking, status) => {
  const params = new URLSearchParams({
    id: booking.id,
    token: booking.manageToken,
    status
  });

  return `${baseUrl}/.netlify/functions/manage-booking?${params}`;
};

export const sendEmail = async ({ to, subject, html, text, replyTo, idempotencyKey }) => {
  requireEmailConfig();

  const payload = {
    from: process.env.BOOKING_FROM_EMAIL,
    to,
    subject,
    html,
    text,
    reply_to: replyTo || getReplyToEmail()
  };

  const response = await fetch(EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || `Email delivery failed with status ${response.status}.`);
  }

  return result;
};

export const sendNewBookingEmails = async (booking, baseUrl) => {
  const confirmUrl = manageBookingUrl(baseUrl, booking, "confirmed");
  const cancelUrl = manageBookingUrl(baseUrl, booking, "cancelled");
  const adminHtml = emailLayout(
    "New booking request",
    `
      <p>A new detailing request came in from the website.</p>
      ${detailsHtml(booking)}
      <p style="margin: 22px 0 0;">
        <a href="${confirmUrl}" style="background:#1d5f4a;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;">Confirm booking</a>
        <a href="${cancelUrl}" style="background:#ad2f25;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;margin-left:8px;">Cancel request</a>
      </p>
    `
  );
  const customerHtml = emailLayout(
    "We received your detailing request",
    `
      <p>Thanks for requesting a mobile detail with ${escapeHtml(BUSINESS_NAME)}. The appointment below is not confirmed until our team follows up.</p>
      ${detailsHtml(booking)}
      <p style="margin: 18px 0 0;">Reply to this email or call ${escapeHtml(BUSINESS_PHONE)} if anything needs to change.</p>
    `
  );

  await sendEmail({
    to: getAdminEmails(),
    subject: `New booking request: ${booking.service}`,
    html: adminHtml,
    text: `New booking request\n\n${detailsText(booking)}\n\nConfirm: ${confirmUrl}\nCancel: ${cancelUrl}`,
    replyTo: booking.customer.email,
    idempotencyKey: `${booking.id}-admin-new`
  });

  await sendEmail({
    to: booking.customer.email,
    subject: "We received your Cleveland Clean booking request",
    html: customerHtml,
    text: `Thanks for requesting a mobile detail with ${BUSINESS_NAME}. This appointment is not confirmed until our team follows up.\n\n${detailsText(booking)}\n\nCall ${BUSINESS_PHONE} if anything needs to change.`,
    idempotencyKey: `${booking.id}-customer-new`
  });
};

export const sendStatusEmail = async (booking) => {
  const isConfirmed = booking.status === "confirmed";
  const title = isConfirmed ? "Your detailing appointment is confirmed" : "Your detailing request was cancelled";
  const statusText = isConfirmed
    ? "Your mobile detailing appointment is confirmed. Reply to this email if anything changes before your appointment."
    : "Your mobile detailing request was cancelled. Reply to this email or call us if you still need help booking.";

  await sendEmail({
    to: booking.customer.email,
    subject: isConfirmed ? "Your Cleveland Clean appointment is confirmed" : "Your Cleveland Clean request was cancelled",
    html: emailLayout(title, `<p>${escapeHtml(statusText)}</p>${detailsHtml(booking)}`),
    text: `${statusText}\n\n${detailsText(booking)}`,
    idempotencyKey: `${booking.id}-customer-${booking.status}-${booking.updatedAt}`
  });
};

export const sendAdminReminder = async (booking, hoursBefore) => {
  const label = hoursBefore >= 1 ? `${hoursBefore} hour` : `${Math.round(hoursBefore * 60)} minute`;
  const pluralLabel = hoursBefore === 1 ? label : `${label}s`;

  await sendEmail({
    to: getAdminEmails(),
    subject: `Reminder: ${booking.service} in ${pluralLabel}`,
    html: emailLayout(`Upcoming booking in ${pluralLabel}`, `${detailsHtml(booking)}<p style="margin:18px 0 0;">Status: ${escapeHtml(booking.status)}</p>`),
    text: `Upcoming booking in ${pluralLabel}\n\nStatus: ${booking.status}\n${detailsText(booking)}`,
    replyTo: booking.customer.email,
    idempotencyKey: `${booking.id}-admin-reminder-${hoursBefore}`
  });
};

export const sendCustomerFollowUp = async (booking) => {
  const reviewUrl = process.env.BOOKING_REVIEW_URL || BUSINESS_REVIEW_URL;

  await sendEmail({
    to: booking.customer.email,
    subject: "How did your Cleveland Clean detail turn out?",
    html: emailLayout(
      "Thanks for choosing Cleveland Clean",
      `
        <p>Thanks again for trusting us with your vehicle. If everything looks great, a quick Google review helps local Cleveland drivers find us.</p>
        <p><a href="${reviewUrl}" style="background:#1d5f4a;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;">Leave a Google review</a></p>
        <p>If anything needs another look, reply to this email and we will make it right.</p>
      `
    ),
    text: `Thanks again for trusting ${BUSINESS_NAME} with your vehicle. If everything looks great, a quick Google review helps local Cleveland drivers find us: ${reviewUrl}\n\nIf anything needs another look, reply to this email and we will make it right.`,
    idempotencyKey: `${booking.id}-customer-follow-up`
  });
};

export const getReminderHours = () => {
  return String(process.env.BOOKING_ADMIN_REMINDER_HOURS || "24,2")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);
};

export const getCustomerFollowUpHours = () => {
  const value = Number(process.env.BOOKING_CUSTOMER_FOLLOWUP_HOURS || 24);
  return Number.isFinite(value) && value > 0 ? value : 24;
};
