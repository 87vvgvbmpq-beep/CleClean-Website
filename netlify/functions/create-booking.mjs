import {
  bookingKey,
  getBookingStore,
  jsonResponse,
  normalizeBooking,
  readRequestData,
  requireEmailConfig
} from "./_booking-utils.mjs";
import { sendConfirmedBookingEmails } from "./_calendar-booking-emails.mjs";
import { claimAvailabilitySlot, requireGoogleCalendarConfig } from "./_google-calendar.mjs";

const cleanSlotId = (value) => String(value || "").trim().slice(0, 256);

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
    const slotId = cleanSlotId(data.slotId || booking.calendar?.slotId);

    if (!slotId) {
      errors.unshift("Please choose an available appointment time.");
    }

    if (errors.length) {
      return jsonResponse({ message: errors[0], errors }, 400);
    }

    requireEmailConfig();
    requireGoogleCalendarConfig();

    const now = new Date().toISOString();
    const storedBooking = {
      ...booking,
      id: crypto.randomUUID(),
      manageToken: crypto.randomUUID(),
      status: "confirmed",
      createdAt: now,
      updatedAt: now,
      source: "website-calendar",
      calendar: {
        ...(booking.calendar || {}),
        slotId
      },
      automation: {
        adminRemindersSent: [],
        customerFollowUpSent: false,
        customerStatusEmailsSent: []
      }
    };
    const claimedSlot = await claimAvailabilitySlot(storedBooking);

    storedBooking.appointment = {
      date: claimedSlot.date,
      time: claimedSlot.time,
      timeZone: claimedSlot.timeZone,
      startsAt: claimedSlot.startsAt,
      endsAt: claimedSlot.endsAt,
      label: claimedSlot.label
    };
    storedBooking.calendar = {
      slotId: claimedSlot.id,
      calendarId: claimedSlot.calendarId,
      originalTitle: claimedSlot.originalTitle,
      bookedTitle: claimedSlot.bookedTitle,
      eventAction: claimedSlot.action
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

    let emailSent = true;

    try {
      await sendConfirmedBookingEmails(storedBooking);
    } catch (error) {
      emailSent = false;
      console.error("Booking confirmation email failed", storedBooking.id, error);
    }

    return jsonResponse({
      id: storedBooking.id,
      message: emailSent
        ? "Appointment booked. A confirmation email is on the way."
        : "Appointment booked, but the confirmation email could not be sent. Please call Cleveland Clean if you do not hear from us shortly."
    });
  } catch (error) {
    console.error("create-booking failed", error);
    const isConfigurationError = error.message?.includes("Booking email automation is missing");
    const status = isConfigurationError ? 503 : error.status || 500;
    let message = "The booking automation is not available right now.";

    if (isConfigurationError) {
      message = "Online booking email is not configured yet.";
    } else if (error.status === 409) {
      message = "That appointment time was just booked. Please choose another time.";
    } else if (error.status === 503) {
      message = error.message;
    }

    return jsonResponse({
      message
    }, status);
  }
};
