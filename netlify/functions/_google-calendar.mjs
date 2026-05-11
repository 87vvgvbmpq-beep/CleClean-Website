import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
const DAY = 24 * 60 * 60 * 1000;

let cachedToken = null;
let cachedCalendarId = null;

export class GoogleCalendarError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
  }
}

export const requireGoogleCalendarConfig = () => {
  const missing = [];

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!process.env.GOOGLE_PRIVATE_KEY) missing.push("GOOGLE_PRIVATE_KEY");

  if (missing.length) {
    throw new GoogleCalendarError(`Google Calendar booking is missing: ${missing.join(", ")}`, 503);
  }
};

const base64UrlJson = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const serviceAccountPrivateKey = () => {
  return process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
};

const getAccessToken = async () => {
  requireGoogleCalendarConfig();

  if (cachedToken && cachedToken.expiresAt - Date.now() > 60 * 1000) {
    return cachedToken.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const unsignedJwt = [
    base64UrlJson({ alg: "RS256", typ: "JWT" }),
    base64UrlJson({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: CALENDAR_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600
    })
  ].join(".");
  const signature = createSign("RSA-SHA256")
    .update(unsignedJwt)
    .end()
    .sign(serviceAccountPrivateKey())
    .toString("base64url");
  const assertion = `${unsignedJwt}.${signature}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new GoogleCalendarError(result.error_description || result.error || "Google Calendar authorization failed.", 503);
  }

  cachedToken = {
    accessToken: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000
  };

  return cachedToken.accessToken;
};

const googleRequest = async (path, options = {}) => {
  const accessToken = await getAccessToken();
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!response.ok) {
    const message = body?.error?.message || body?.message || `Google Calendar request failed with status ${response.status}.`;
    throw new GoogleCalendarError(message, response.status);
  }

  return body;
};

export const getCalendarName = () => process.env.GOOGLE_CALENDAR_NAME || "Detailing";

export const getAvailabilityPrefix = () => process.env.GOOGLE_AVAILABLE_EVENT_PREFIX || "Available.";

export const getSlotBookingAction = () => {
  return process.env.GOOGLE_BOOKING_EVENT_ACTION === "delete" ? "delete" : "update";
};

export const getDetailingCalendarId = async () => {
  if (process.env.GOOGLE_CALENDAR_ID) {
    return process.env.GOOGLE_CALENDAR_ID;
  }

  if (cachedCalendarId) {
    return cachedCalendarId;
  }

  const calendarName = getCalendarName();
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      maxResults: "250",
      minAccessRole: "writer",
      showDeleted: "false",
      ...(pageToken ? { pageToken } : {})
    });
    const result = await googleRequest(`/users/me/calendarList?${params}`);
    const calendar = (result.items || []).find((item) => item.summary === calendarName);

    if (calendar?.id) {
      cachedCalendarId = calendar.id;
      return cachedCalendarId;
    }

    pageToken = result.nextPageToken || "";
  } while (pageToken);

  throw new GoogleCalendarError(`Google Calendar named "${calendarName}" was not found or is not writable by the service account.`, 503);
};

const zoneParts = (isoDate, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(isoDate));

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
};

const slotDateTime = (isoDate, timeZone) => {
  const parts = zoneParts(isoDate, timeZone);

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
};

const formatSlotLabel = (startIso, endIso, timeZone) => {
  const start = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(startIso));
  const end = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(endIso));

  return `${start} - ${end}`;
};

export const eventToSlot = (event, calendarId, fallbackTimeZone) => {
  const startsAt = event.start?.dateTime;
  const endsAt = event.end?.dateTime;

  if (!startsAt || !endsAt) {
    return null;
  }

  const timeZone = event.start?.timeZone || fallbackTimeZone;
  const fields = slotDateTime(startsAt, timeZone);

  return {
    id: event.id,
    calendarId,
    title: event.summary || "",
    startsAt,
    endsAt,
    timeZone,
    date: fields.date,
    time: fields.time,
    label: formatSlotLabel(startsAt, endsAt, timeZone)
  };
};

export const listAvailableSlots = async () => {
  const calendarId = await getDetailingCalendarId();
  const timeZone = process.env.BOOKING_TIME_ZONE || "America/New_York";
  const lookaheadDays = Number(process.env.GOOGLE_BOOKING_LOOKAHEAD_DAYS || 30);
  const safeLookaheadDays = Number.isFinite(lookaheadDays) && lookaheadDays > 0 ? lookaheadDays : 30;
  const now = new Date();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    showDeleted: "false",
    maxResults: "100",
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + safeLookaheadDays * DAY).toISOString(),
    timeZone
  });
  const result = await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  const prefix = getAvailabilityPrefix();

  return (result.items || [])
    .filter((event) => (event.summary || "").startsWith(prefix))
    .map((event) => eventToSlot(event, calendarId, timeZone))
    .filter(Boolean);
};

export const claimAvailabilitySlot = async (booking) => {
  const calendarId = await getDetailingCalendarId();
  const eventId = booking.calendar?.slotId;

  if (!eventId) {
    throw new GoogleCalendarError("Please choose an available appointment time.", 400);
  }

  let event;

  try {
    event = await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  } catch (error) {
    if ([404, 409, 412].includes(error.status)) {
      throw new GoogleCalendarError("That appointment time was just booked. Please choose another time.", 409);
    }

    throw error;
  }
  const prefix = getAvailabilityPrefix();

  if (!(event.summary || "").startsWith(prefix)) {
    throw new GoogleCalendarError("That appointment time was just booked. Please choose another time.", 409);
  }

  const slot = eventToSlot(event, calendarId, process.env.BOOKING_TIME_ZONE || "America/New_York");

  if (!slot) {
    throw new GoogleCalendarError("That calendar event is not a valid appointment slot.", 409);
  }

  if (getSlotBookingAction() === "delete") {
    try {
      await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
        method: "DELETE",
        headers: {
          "If-Match": event.etag
        }
      });
    } catch (error) {
      if ([404, 409, 412].includes(error.status)) {
        throw new GoogleCalendarError("That appointment time was just booked. Please choose another time.", 409);
      }

      throw error;
    }

    return {
      ...slot,
      action: "delete",
      originalTitle: event.summary,
      bookedTitle: null
    };
  }

  const bookedTitle = `Booked - ${booking.customer.name}`;

  try {
    await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      method: "PATCH",
      headers: {
        "If-Match": event.etag
      },
      body: JSON.stringify({
        summary: bookedTitle,
        description: [
          event.description || "",
          "",
          `Booked from website: ${booking.id}`,
          `Customer: ${booking.customer.name}`,
          `Email: ${booking.customer.email}`,
          `Phone: ${booking.customer.phone}`,
          `Service: ${booking.service}`,
          `Vehicle: ${booking.vehicle}`,
          `Address: ${booking.address.street}, ${booking.address.city}`,
          `Notes: ${booking.notes || "None"}`
        ].join("\n").trim()
      })
    });
  } catch (error) {
    if ([404, 409, 412].includes(error.status)) {
      throw new GoogleCalendarError("That appointment time was just booked. Please choose another time.", 409);
    }

    throw error;
  }

  return {
    ...slot,
    action: "update",
    originalTitle: event.summary,
    bookedTitle
  };
};
