const BUSINESS_EMAIL = "bookings@clevelandcleandetailing.com";
const BUSINESS_PHONE = "(216) 659-1510";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const escapeHtml = (value) => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const splitEmails = (value) => {
  return String(value || BUSINESS_EMAIL)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
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
  `Status: ${booking.status}`,
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
    ["Status", booking.status],
    ["Notes", booking.notes || "No notes provided."]
  ];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101317">
      <h1 style="margin:0 0 14px;font-size:24px">New booking request</h1>
      <p style="margin:0 0 18px">Reply to this email or open the bookings admin page to confirm or decline the request.</p>
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

const receivedHtml = (booking) => `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101317">
    <h1 style="margin:0 0 14px;font-size:24px">We received your booking request</h1>
    <p>Thanks, ${escapeHtml(booking.name)}. Cleveland Clean Car Detailing &amp; Ceramics LLC will follow up to confirm the appointment.</p>
    <p><strong>Requested time:</strong> ${escapeHtml(booking.date)} at ${escapeHtml(booking.time)}</p>
    <p><strong>Service:</strong> ${escapeHtml(booking.service)}</p>
    <p>If you need to change anything, reply to this email or call ${BUSINESS_PHONE}.</p>
  </div>
`;

const statusHtml = (booking, status) => {
  const isConfirmed = status === "confirmed";
  const heading = isConfirmed
    ? "Your booking is confirmed"
    : "We need to find another time";
  const body = isConfirmed
    ? "Your Cleveland Clean appointment request has been confirmed."
    : "We could not confirm the requested time. Reply to this email and we will help find another opening.";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101317">
      <h1 style="margin:0 0 14px;font-size:24px">${heading}</h1>
      <p>Hi ${escapeHtml(booking.name)},</p>
      <p>${body}</p>
      <p><strong>Requested time:</strong> ${escapeHtml(booking.date)} at ${escapeHtml(booking.time)}</p>
      <p><strong>Service:</strong> ${escapeHtml(booking.service)}</p>
      <p>Questions? Reply to this email or call ${BUSINESS_PHONE}.</p>
    </div>
  `;
};

export const sendEmail = async (env, { to, replyTo, subject, text, html }) => {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const from = env.BOOKING_FROM_EMAIL || `Cleveland Clean <${BUSINESS_EMAIL}>`;
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
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

export const sendNewBookingEmails = async (env, booking) => {
  if (!env.RESEND_API_KEY) {
    return { skipped: true };
  }

  const businessReplyTo = env.BOOKING_REPLY_TO_EMAIL || BUSINESS_EMAIL;
  const adminRecipients = splitEmails(env.BOOKING_ADMIN_EMAILS || env.BOOKING_TO_EMAIL);
  const subjectDate = booking.date ? ` for ${booking.date}` : "";

  await sendEmail(env, {
    to: adminRecipients,
    replyTo: booking.email,
    subject: `New booking request${subjectDate}: ${booking.name}`,
    text: textSummary(booking),
    html: adminHtml(booking)
  });

  await sendEmail(env, {
    to: booking.email,
    replyTo: businessReplyTo,
    subject: "We received your Cleveland Clean booking request",
    text: [
      `Thanks, ${booking.name}. We received your booking request.`,
      `Requested time: ${booking.date} at ${booking.time}`,
      `Service: ${booking.service}`,
      `Reply to this email or call ${BUSINESS_PHONE} if you need to change anything.`
    ].join("\n"),
    html: receivedHtml(booking)
  });

  return { skipped: false };
};

export const sendCustomerStatusEmail = async (env, booking, status) => {
  const businessReplyTo = env.BOOKING_REPLY_TO_EMAIL || BUSINESS_EMAIL;
  const isConfirmed = status === "confirmed";

  await sendEmail(env, {
    to: booking.email,
    replyTo: businessReplyTo,
    subject: isConfirmed
      ? "Your Cleveland Clean booking is confirmed"
      : "Update on your Cleveland Clean booking request",
    text: [
      `Hi ${booking.name},`,
      "",
      isConfirmed
        ? "Your Cleveland Clean appointment request has been confirmed."
        : "We could not confirm the requested time. Reply to this email and we will help find another opening.",
      "",
      `Requested time: ${booking.date} at ${booking.time}`,
      `Service: ${booking.service}`,
      `Questions? Reply to this email or call ${BUSINESS_PHONE}.`
    ].join("\n"),
    html: statusHtml(booking, status)
  });
};
