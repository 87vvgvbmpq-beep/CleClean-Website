const BUSINESS_EMAIL = "bookings@clevelandcleandetailing.com";
const BUSINESS_PHONE = "(216) 659-1510";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const responseHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

const jsonResponse = (body, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders
  });
};

const cleanText = (value, maxLength = 160) => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

const cleanNotes = (value) => {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);
};

const escapeHtml = (value) => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const splitEmails = (value) => {
  return String(value || BUSINESS_EMAIL)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
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

const normalizeBooking = (data) => {
  const booking = {
    name: cleanText(data.name, 100),
    email: cleanText(data.email, 160).toLowerCase(),
    phone: cleanText(data.phone, 60),
    service: cleanText(data.service, 120),
    vehicle: cleanText(data.vehicle, 140),
    date: cleanText(data.date, 40),
    time: cleanText(data.time, 40),
    address: cleanText(data.address, 180),
    city: cleanText(data.city, 100),
    notes: cleanNotes(data.notes)
  };
  const consent = data.consent === true
    || data.consent === "true"
    || data.consent === "on"
    || data.consent === "1";
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
  if (!consent) errors.push("Contact consent is required.");

  return { booking, errors };
};

const textSummary = (booking) => [
  "New Cleveland Clean booking request",
  "",
  `Name: ${booking.name}`,
  `Email: ${booking.email}`,
  `Phone: ${booking.phone}`,
  `Service: ${booking.service}`,
  `Vehicle: ${booking.vehicle}`,
  `Preferred date: ${booking.date}`,
  `Preferred time: ${booking.time}`,
  `Address: ${booking.address}`,
  `City: ${booking.city}`,
  "",
  "Notes:",
  booking.notes || "No notes provided."
].join("\n");

const adminHtml = (booking) => {
  const replySubject = encodeURIComponent(`Re: Cleveland Clean booking request for ${booking.date}`);
  const replyBody = encodeURIComponent(`Hi ${booking.name},\n\n`);
  const replyHref = `mailto:${booking.email}?subject=${replySubject}&body=${replyBody}`;
  const rows = [
    ["Name", booking.name],
    ["Email", booking.email],
    ["Phone", booking.phone],
    ["Service", booking.service],
    ["Vehicle", booking.vehicle],
    ["Preferred date", booking.date],
    ["Preferred time", booking.time],
    ["Address", booking.address],
    ["City", booking.city],
    ["Notes", booking.notes || "No notes provided."]
  ];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101317">
      <h1 style="margin:0 0 14px;font-size:24px">New booking request</h1>
      <p style="margin:0 0 18px">Reply to this email or use the button below to respond to the customer.</p>
      <p style="margin:0 0 22px">
        <a href="${replyHref}" style="display:inline-block;background:#ad2f25;color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:6px">Reply to customer</a>
      </p>
      <table style="width:100%;border-collapse:collapse">
        ${rows.map(([label, value]) => `
          <tr>
            <th style="text-align:left;vertical-align:top;padding:9px 10px;border:1px solid #d8ddd7;background:#f6f7f2;width:160px">${escapeHtml(label)}</th>
            <td style="padding:9px 10px;border:1px solid #d8ddd7">${escapeHtml(value)}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
};

const customerHtml = (booking) => `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101317">
    <h1 style="margin:0 0 14px;font-size:24px">We received your booking request</h1>
    <p>Thanks, ${escapeHtml(booking.name)}. Cleveland Clean Car Detailing &amp; Ceramics LLC will follow up to confirm the appointment.</p>
    <p><strong>Requested time:</strong> ${escapeHtml(booking.date)} at ${escapeHtml(booking.time)}</p>
    <p><strong>Service:</strong> ${escapeHtml(booking.service)}</p>
    <p>If you need to change anything, reply to this email or call ${BUSINESS_PHONE}.</p>
  </div>
`;

const sendEmail = async (apiKey, { to, from, replyTo, subject, text, html }) => {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Resend rejected the email: ${message}`);
  }
};

const handleBookingRequest = async (request, env) => {
  const data = await readRequestData(request);

  if (cleanText(data.company)) {
    return jsonResponse({
      message: "Booking request sent. We will follow up to confirm the appointment."
    });
  }

  const { booking, errors } = normalizeBooking(data);

  if (errors.length) {
    return jsonResponse({ message: errors.join(" ") }, 400);
  }

  if (!env.RESEND_API_KEY) {
    return jsonResponse({
      message: "Online booking email is not configured yet."
    }, 503);
  }

  const from = env.BOOKING_FROM_EMAIL || `Cleveland Clean <${BUSINESS_EMAIL}>`;
  const adminRecipients = splitEmails(env.BOOKING_ADMIN_EMAILS || env.BOOKING_TO_EMAIL);
  const businessReplyTo = env.BOOKING_REPLY_TO_EMAIL || BUSINESS_EMAIL;
  const subjectDate = booking.date ? ` for ${booking.date}` : "";

  await sendEmail(env.RESEND_API_KEY, {
    from,
    to: adminRecipients,
    replyTo: booking.email,
    subject: `New booking request${subjectDate}: ${booking.name}`,
    text: textSummary(booking),
    html: adminHtml(booking)
  });

  await sendEmail(env.RESEND_API_KEY, {
    from,
    to: [booking.email],
    replyTo: businessReplyTo,
    subject: "We received your Cleveland Clean booking request",
    text: [
      `Thanks, ${booking.name}. We received your booking request.`,
      `Requested time: ${booking.date} at ${booking.time}`,
      `Service: ${booking.service}`,
      `Reply to this email or call ${BUSINESS_PHONE} if you need to change anything.`
    ].join("\n"),
    html: customerHtml(booking)
  });

  return jsonResponse({
    message: "Booking request sent. We will follow up to confirm the appointment."
  });
};

export const onRequest = async ({ request, env }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "Method not allowed." }, 405);
  }

  try {
    return await handleBookingRequest(request, env);
  } catch (error) {
    console.error(error);
    return jsonResponse({
      message: "Booking request could not be completed. Please call or email us directly."
    }, 500);
  }
};
