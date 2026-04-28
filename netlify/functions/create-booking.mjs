import {
  baseUrlFromRequest,
  bookingKey,
  getBookingStore,
  jsonResponse,
  normalizeBooking,
  readRequestData,
  requireEmailConfig,
  sendNewBookingEmails
} from "./_booking-utils.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "Booking requests must be submitted with POST." }, 405);
  }

  try {
    const data = await readRequestData(request);

    if (data.company) {
      return jsonResponse({ message: "Booking request sent. Cleveland Clean will follow up soon." });
    }

    const { booking, errors } = normalizeBooking(data);

    if (errors.length) {
      return jsonResponse({ message: errors[0], errors }, 400);
    }

    requireEmailConfig();

    const now = new Date().toISOString();
    const storedBooking = {
      ...booking,
      id: crypto.randomUUID(),
      manageToken: crypto.randomUUID(),
      status: "requested",
      createdAt: now,
      updatedAt: now,
      source: "website",
      automation: {
        adminRemindersSent: [],
        customerFollowUpSent: false,
        customerStatusEmailsSent: []
      }
    };

    const store = getBookingStore();
    await store.setJSON(bookingKey(storedBooking.id), storedBooking, {
      metadata: {
        status: storedBooking.status,
        appointment: storedBooking.appointment.startsAt,
        customer: storedBooking.customer.email
      },
      onlyIfNew: true
    });

    await sendNewBookingEmails(storedBooking, baseUrlFromRequest(request));

    return jsonResponse({
      id: storedBooking.id,
      message: "Booking request sent. Cleveland Clean will follow up soon."
    });
  } catch (error) {
    console.error("create-booking failed", error);
    return jsonResponse({
      message: "The booking automation is not available right now."
    }, 500);
  }
};
