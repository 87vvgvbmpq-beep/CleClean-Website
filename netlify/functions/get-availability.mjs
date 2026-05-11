import { jsonResponse } from "./_booking-utils.mjs";
import { listAvailableSlots } from "./_google-calendar.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (request.method !== "GET") {
    return jsonResponse({ message: "Availability must be requested with GET." }, 405);
  }

  try {
    const slots = await listAvailableSlots();

    return jsonResponse({
      slots,
      message: slots.length
        ? "Available appointment times loaded."
        : "No available appointment times are posted right now."
    });
  } catch (error) {
    console.error("get-availability failed", error);

    return jsonResponse({
      message: error.status === 503
        ? error.message
        : "Available appointment times could not be loaded right now."
    }, error.status || 500);
  }
};
