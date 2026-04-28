import {
  bookingKey,
  getBookingStore,
  getCustomerFollowUpHours,
  getReminderHours,
  jsonResponse,
  sendAdminReminder,
  sendCustomerFollowUp
} from "./_booking-utils.mjs";

const HOUR = 60 * 60 * 1000;

export default async () => {
  const store = getBookingStore();
  const { blobs } = await store.list({ prefix: "bookings/" });
  const now = Date.now();
  let checked = 0;
  let sent = 0;
  let failed = 0;

  for (const blob of blobs) {
    checked += 1;
    const booking = await store.get(blob.key, { type: "json" });

    if (!booking || booking.status === "cancelled" || !booking.appointment?.startsAt) {
      continue;
    }

    const appointmentTime = Date.parse(booking.appointment.startsAt);

    if (!Number.isFinite(appointmentTime)) {
      continue;
    }

    let changed = false;
    booking.automation ||= {};
    booking.automation.adminRemindersSent ||= [];
    booking.automation.customerFollowUpSent ||= false;

    for (const hoursBefore of getReminderHours()) {
      const reminderAlreadySent = booking.automation.adminRemindersSent.includes(hoursBefore);
      const millisecondsUntilAppointment = appointmentTime - now;

      if (!reminderAlreadySent && millisecondsUntilAppointment > 0 && millisecondsUntilAppointment <= hoursBefore * HOUR) {
        try {
          await sendAdminReminder(booking, hoursBefore);
          booking.automation.adminRemindersSent.push(hoursBefore);
          changed = true;
          sent += 1;
        } catch (error) {
          failed += 1;
          console.error("Admin reminder failed", booking.id, hoursBefore, error);
        }
      }
    }

    const followUpTime = appointmentTime + getCustomerFollowUpHours() * HOUR;

    if (booking.status === "confirmed" && !booking.automation.customerFollowUpSent && now >= followUpTime) {
      try {
        await sendCustomerFollowUp(booking);
        booking.automation.customerFollowUpSent = true;
        changed = true;
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error("Customer follow-up failed", booking.id, error);
      }
    }

    if (changed) {
      booking.updatedAt = new Date().toISOString();
      await store.setJSON(bookingKey(booking.id), booking, {
        metadata: {
          status: booking.status,
          appointment: booking.appointment.startsAt,
          customer: booking.customer.email
        }
      });
    }
  }

  return jsonResponse({ checked, sent, failed });
};

export const config = {
  schedule: "@hourly"
};
