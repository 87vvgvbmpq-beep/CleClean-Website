import {
  BUSINESS_NAME,
  bookingKey,
  escapeHtml,
  formatAppointment,
  getBookingStore,
  htmlResponse,
  sendStatusEmail
} from "./_booking-utils.mjs";

const page = (title, body) => {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <style>
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f6f7f2; color: #101317; }
        main { width: min(720px, calc(100% - 32px)); margin: 12vh auto; padding: 32px; background: #fff; border: 1px solid #d8ddd7; border-radius: 8px; box-shadow: 0 18px 48px rgba(16, 19, 23, 0.14); }
        h1 { margin: 0 0 14px; color: #103b30; line-height: 1.05; }
        p { line-height: 1.55; color: #5b6470; }
        a { color: #1d5f4a; font-weight: 800; }
      </style>
    </head>
    <body>
      <main>
        <h1>${title}</h1>
        ${body}
      </main>
    </body>
  </html>`;
};

export default async (request) => {
  if (request.method !== "GET") {
    return htmlResponse(page("Method not allowed", "<p>This booking action only accepts secure email links.</p>"), 405);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const token = url.searchParams.get("token") || "";
  const status = url.searchParams.get("status") || "";

  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9-]{36}$/i.test(token) || !["confirmed", "cancelled"].includes(status)) {
    return htmlResponse(page("Booking link expired", "<p>This booking management link is invalid.</p>"), 400);
  }

  try {
    const store = getBookingStore();
    const key = bookingKey(id);
    const booking = await store.get(key, { type: "json" });

    if (!booking || booking.manageToken !== token) {
      return htmlResponse(page("Booking link expired", "<p>This booking management link is invalid.</p>"), 404);
    }

    const previousStatus = booking.status;
    booking.status = status;
    booking.updatedAt = new Date().toISOString();

    await store.setJSON(key, booking, {
      metadata: {
        status: booking.status,
        appointment: booking.appointment.startsAt,
        customer: booking.customer.email
      }
    });

    let emailMessage = "The customer has been notified.";

    if (previousStatus !== status) {
      try {
        await sendStatusEmail(booking);
      } catch (error) {
        console.error("Customer status email failed", error);
        emailMessage = "The booking status was saved, but the customer email could not be sent.";
      }
    } else {
      emailMessage = "The booking already had this status.";
    }

    const title = status === "confirmed" ? "Booking confirmed" : "Booking cancelled";
    const body = `
      <p>${escapeHtml(BUSINESS_NAME)} booking for ${escapeHtml(booking.customer.name)} is now <strong>${escapeHtml(status)}</strong>.</p>
      <p>${escapeHtml(formatAppointment(booking))}<br>${escapeHtml(booking.service)}<br>${escapeHtml(booking.vehicle)}</p>
      <p>${escapeHtml(emailMessage)}</p>
      <p><a href="/">Back to website</a></p>
    `;

    return htmlResponse(page(title, body));
  } catch (error) {
    console.error("manage-booking failed", error);
    return htmlResponse(page("Booking action failed", "<p>The booking could not be updated right now.</p>"), 500);
  }
};
