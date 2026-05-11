import {
  BUSINESS_EMAIL,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  escapeHtml,
  formatAppointment,
  getAdminEmails,
  getReplyToEmail,
  sendEmail
} from "./_booking-utils.mjs";

const detailRows = (booking) => [
  ["Customer", booking.customer?.name],
  ["Email", booking.customer?.email],
  ["Phone", booking.customer?.phone],
  ["Service", booking.service],
  ["Vehicle", booking.vehicle],
  ["Appointment", formatAppointment(booking)],
  ["Address", `${booking.address?.street || ""}, ${booking.address?.city || ""}`],
  ["Notes", booking.notes || "None"]
];

const detailsHtml = (booking) => `
  <table style="border-collapse:collapse;width:100%;margin:18px 0;">
    ${detailRows(booking)
      .map(([label, value]) => `
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #d8e2df;color:#31524c;">${escapeHtml(label)}</th>
          <td style="padding:8px;border-bottom:1px solid #d8e2df;">${escapeHtml(value || "")}</td>
        </tr>
      `)
      .join("")}
  </table>
`;

const detailsText = (booking) => {
  return detailRows(booking).map(([label, value]) => `${label}: ${value || ""}`).join("\n");
};

const emailFrame = (title, body) => `
  <div style="font-family:Arial,sans-serif;color:#172522;line-height:1.5;">
    <h1 style="font-size:22px;margin:0 0 16px;color:#075a3d;">${escapeHtml(title)}</h1>
    ${body}
  </div>
`;

export const sendConfirmedBookingEmails = async (booking) => {
  const appointmentText = formatAppointment(booking);
  const replySubject = `Re: Cleveland Clean booking for ${booking.service}`;
  const replyBody = `Hi ${booking.customer.name},\n\nThanks for booking with Cleveland Clean. `;
  const gmailReplyUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(booking.customer.email)}&su=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`;
  const calendarStatus = booking.calendar?.eventAction === "delete"
    ? "Availability event deleted"
    : "Availability event marked booked";

  await sendEmail({
    to: getAdminEmails(),
    subject: `Booked: ${booking.service} for ${booking.customer.name}`,
    html: emailFrame(
      "Calendar booking confirmed",
      `
        <p>${escapeHtml(booking.customer.name)} booked an available calendar time.</p>
        ${detailsHtml(booking)}
        <p style="margin:18px 0 0;">Calendar status: ${escapeHtml(calendarStatus)}</p>
        <p style="margin:22px 0 0;">
          <a href="${escapeHtml(gmailReplyUrl)}" style="background:#2f5f9f;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:700;">Reply in Gmail</a>
        </p>
      `
    ),
    text: `Calendar booking confirmed\n\n${detailsText(booking)}\n\nCalendar status: ${calendarStatus}\nReply in Gmail: ${gmailReplyUrl}`,
    replyTo: booking.customer.email,
    idempotencyKey: `${booking.id}-admin-confirmed`
  });

  await sendEmail({
    to: booking.customer.email,
    subject: "Your Cleveland Clean appointment is confirmed",
    html: emailFrame(
      "Your appointment is confirmed",
      `
        <p>Your ${escapeHtml(BUSINESS_NAME)} appointment is booked for ${escapeHtml(appointmentText)}.</p>
        ${detailsHtml(booking)}
        <p style="margin:18px 0 0;">Reply to this email, email ${escapeHtml(BUSINESS_EMAIL)}, or call ${escapeHtml(BUSINESS_PHONE)} if you have a question or need to change anything.</p>
      `
    ),
    text: `Your ${BUSINESS_NAME} appointment is booked for ${appointmentText}.\n\n${detailsText(booking)}\n\nReply to this email, email ${BUSINESS_EMAIL}, or call ${BUSINESS_PHONE} if you have a question or need to change anything.`,
    replyTo: getReplyToEmail(),
    idempotencyKey: `${booking.id}-customer-confirmed`
  });
};
