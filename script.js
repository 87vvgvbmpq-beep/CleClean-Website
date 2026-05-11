const comparisons = document.querySelectorAll("[data-comparison]");

comparisons.forEach((comparison) => {
  const range = comparison.querySelector("[data-range]");
  const beforeWrap = comparison.querySelector("[data-before-wrap]");
  const handle = comparison.querySelector("[data-handle]");

  if (!range || !beforeWrap || !handle) {
    return;
  }

  const setPosition = (value) => {
    const percent = `${value}%`;
    beforeWrap.style.width = percent;
    handle.style.left = percent;
  };

  range.addEventListener("input", (event) => {
    setPosition(event.target.value);
  });

  setPosition(range.value);
});

const servicesEndpoint = "/content/services.json";
const appointmentSettingsEndpoint = "/content/booking.json";
const servicesGridSelector = "[data-services-grid], .service-grid";
const servicesSelectSelector = "[data-services-select], select[name='service']";
const bookingForm = document.querySelector("[data-booking-form]");
const bookingFallbackEmail = "bookings@clevelandcleandetailing.com";

const defaultAppointmentSettings = {
  appointmentScheduleUrl: "",
  embed: true,
  heading: "Check available request times",
  description: "Use this calendar to see when both detailers are available, then send the booking request below.",
  buttonLabel: "Open Availability Calendar",
  statusText: "Availability calendar setup required. Add the Google Appointment Schedule link in Decap CMS."
};

const normalizeServices = (data) => {
  const services = Array.isArray(data?.services) ? data.services : [];

  return services.filter((service) => {
    return service && service.active !== false && String(service.name || "").trim();
  });
};

const appendText = (parent, tagName, text, className = "") => {
  if (!text) {
    return null;
  }

  const element = document.createElement(tagName);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.append(element);
  return element;
};

const buildBookingEmail = (payload) => {
  const subject = encodeURIComponent(`Booking request from ${payload.name || "website"}`);
  const body = encodeURIComponent([
    "New booking request",
    "",
    `Name: ${payload.name || ""}`,
    `Email: ${payload.email || ""}`,
    `Phone: ${payload.phone || ""}`,
    `Service: ${payload.service || ""}`,
    `Vehicle: ${payload.vehicle || ""}`,
    `Preferred date: ${payload.date || ""}`,
    `Preferred time: ${payload.time || ""}`,
    `Address: ${payload.address || ""}`,
    `City: ${payload.city || ""}`,
    "",
    `Notes: ${payload.notes || ""}`
  ].join("\n"));

  return `mailto:${bookingFallbackEmail}?subject=${subject}&body=${body}`;
};

const serviceCard = (service, index) => {
  const article = document.createElement("article");
  article.className = `service-card${index === 1 ? " featured" : ""}`;

  if (service.image) {
    const image = document.createElement("img");
    image.className = "service-card-image";
    image.src = service.image;
    image.alt = `${service.name} service`;
    image.loading = "lazy";
    image.decoding = "async";
    article.append(image);
  }

  const meta = document.createElement("div");
  meta.className = "service-meta";
  appendText(meta, "span", service.price);
  appendText(meta, "span", service.duration);

  if (meta.children.length) {
    article.append(meta);
  }

  appendText(article, "h3", service.name);
  appendText(article, "p", service.shortDescription, "service-summary");
  appendText(article, "p", service.fullDescription, "service-detail");

  if (Array.isArray(service.features) && service.features.length) {
    const list = document.createElement("ul");
    service.features.filter(Boolean).forEach((feature) => {
      appendText(list, "li", feature);
    });
    article.append(list);
  }

  return article;
};

const renderServiceCards = (services) => {
  const grid = document.querySelector(servicesGridSelector);

  if (!grid || !services.length) {
    return;
  }

  grid.replaceChildren(...services.map(serviceCard));
};

const renderServiceOptions = (services) => {
  const select = document.querySelector(servicesSelectSelector);

  if (!select || !services.length) {
    return;
  }

  const selectedValue = select.value;
  const defaultOption = new Option("Select a service", "");
  const options = services.map((service) => new Option(service.name, service.name));
  options.push(new Option("Not Sure Yet", "Not Sure Yet"));
  select.replaceChildren(defaultOption, ...options);

  if ([...select.options].some((option) => option.value === selectedValue)) {
    select.value = selectedValue;
  }
};

const ensureServiceStyles = () => {
  if (document.querySelector("[data-service-content-styles]")) {
    return;
  }

  const styles = document.createElement("style");
  styles.dataset.serviceContentStyles = "";
  styles.textContent = `
    .service-card{display:flex;flex-direction:column;gap:16px}
    .service-card-image{aspect-ratio:16/10;border-radius:6px;object-fit:cover;background:var(--line)}
    .service-card h3,.service-card p,.service-card ul{margin-top:0}
    .service-meta{display:flex;flex-wrap:wrap;gap:8px}
    .service-meta span{display:inline-flex;align-items:center;min-height:30px;padding:5px 9px;border-radius:4px;background:#eef3ec;color:var(--green-dark);font-size:.86rem;font-weight:900}
    .service-card ul{margin-bottom:0}
  `;
  document.head.append(styles);
};

const loadServices = async () => {
  if (!document.querySelector(servicesGridSelector) && !document.querySelector(servicesSelectSelector)) {
    return;
  }

  try {
    const response = await fetch(servicesEndpoint, {
      headers: {
        "Accept": "application/json"
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error("Service content could not be loaded.");
    }

    const services = normalizeServices(data);
    ensureServiceStyles();
    renderServiceCards(services);
    renderServiceOptions(services);
  } catch (error) {
    console.warn(error);
  }
};

const isGoogleAppointmentScheduleUrl = (value) => {
  try {
    const url = new URL(value);

    return (url.hostname === "calendar.google.com"
      && url.pathname.startsWith("/calendar/appointments/schedules/"))
      || url.hostname === "calendar.app.google";
  } catch {
    return false;
  }
};

const renderAppointmentBooking = (settings) => {
  const booking = ensureAppointmentBookingPanel();

  if (!booking) {
    return;
  }

  const options = {
    ...defaultAppointmentSettings,
    ...settings
  };
  const link = booking.querySelector("[data-appointment-link]");
  const frame = booking.querySelector("[data-appointment-frame]");
  const heading = booking.querySelector("[data-appointment-heading]");
  const description = booking.querySelector("[data-appointment-description]");
  const status = booking.querySelector("[data-appointment-status]");
  const hasScheduleUrl = isGoogleAppointmentScheduleUrl(options.appointmentScheduleUrl);

  if (heading) heading.textContent = options.heading;
  if (description) description.textContent = options.description;

  if (link) {
    link.textContent = hasScheduleUrl ? options.buttonLabel : "Call to Check Availability";
    link.href = hasScheduleUrl ? options.appointmentScheduleUrl : "tel:+12166591510";

    if (hasScheduleUrl) {
      link.target = "_blank";
      link.rel = "noopener";
      link.removeAttribute("aria-disabled");
    } else {
      link.removeAttribute("target");
      link.removeAttribute("rel");
      link.setAttribute("aria-disabled", "true");
    }
  }

  if (status) {
    status.textContent = hasScheduleUrl
      ? options.statusText
      : defaultAppointmentSettings.statusText;
    status.classList.toggle("error", !hasScheduleUrl);
  }

  if (!frame) {
    return;
  }

  frame.replaceChildren();

  if (hasScheduleUrl && options.embed !== false) {
    const iframe = document.createElement("iframe");
    iframe.src = options.appointmentScheduleUrl;
    iframe.title = "Google Calendar appointment schedule";
    iframe.loading = "lazy";
    frame.append(iframe);
  }
};

const ensureAppointmentStyles = () => {
  if (document.querySelector("[data-appointment-booking-styles]")) {
    return;
  }

  const styles = document.createElement("style");
  styles.dataset.appointmentBookingStyles = "";
  styles.textContent = `
    .booking-workflow{display:grid;gap:22px}
    .appointment-card{display:grid;gap:22px;padding:clamp(22px,4vw,34px);border:1px solid rgba(29,95,74,.18);border-radius:8px;background:var(--surface);box-shadow:var(--shadow)}
    .appointment-copy{display:grid;gap:16px}
    .appointment-copy h3,.appointment-copy p,.appointment-checks{margin:0}
    .appointment-copy p:not(.eyebrow),.appointment-checks{color:var(--muted)}
    .appointment-checks{padding-left:18px;font-weight:700}
    .appointment-frame-wrap{overflow:hidden;min-height:0;border-radius:8px;background:#fbfcfa}
    .appointment-frame-wrap iframe{display:block;width:100%;min-height:min(720px,86vh);border:0}
    @media (max-width:520px){.appointment-card{padding:22px}}
  `;
  document.head.append(styles);
};

const ensureAppointmentBookingPanel = () => {
  const existing = document.querySelector("[data-appointment-booking]");

  if (existing) {
    ensureAppointmentStyles();
    return existing;
  }

  const form = document.querySelector("[data-booking-form]");

  if (!form) {
    return null;
  }

  const intro = form.closest(".booking-shell")?.querySelector(".booking-intro");

  if (intro) {
    const title = intro.querySelector("h2");
    const copy = intro.querySelector("p:not(.eyebrow)");

    if (title) title.textContent = "Request an appointment in under a minute.";
    if (copy) copy.textContent = "Check the availability calendar for times both detailers are open, then send the booking request below.";
  }

  const booking = document.createElement("div");
  booking.className = "appointment-card";
  booking.dataset.appointmentBooking = "";
  booking.innerHTML = `
    <div class="appointment-copy">
      <p class="eyebrow">Availability calendar</p>
      <h3 data-appointment-heading>Check available request times</h3>
      <p data-appointment-description>Use this calendar to see when both detailers are available, then send the booking request below.</p>
      <ul class="appointment-checks">
        <li>Shows available windows from the Google Appointment Schedule.</li>
        <li>Availability depends on Brendon and his partner being co-hosts.</li>
        <li>Send the form below after choosing the date and time you want.</li>
      </ul>
      <div class="form-actions">
        <a class="button primary" href="#booking" data-appointment-link target="_blank" rel="noopener">Open Availability Calendar</a>
        <a class="button ghost" href="tel:+12166591510">Call Instead</a>
      </div>
      <p class="form-status" role="status" aria-live="polite" data-appointment-status>Booking calendar setup required. Add the Google Appointment Schedule link in Decap CMS.</p>
    </div>
    <div class="appointment-frame-wrap" data-appointment-frame aria-label="Google appointment schedule"></div>
  `;

  const workflow = document.createElement("div");
  workflow.className = "booking-workflow";
  form.before(workflow);
  workflow.append(booking, form);
  ensureAppointmentStyles();

  return booking;
};

const loadAppointmentBooking = async () => {
  if (!document.querySelector("[data-appointment-booking]") && !document.querySelector("[data-booking-form]")) {
    return;
  }

  try {
    const response = await fetch(appointmentSettingsEndpoint, {
      headers: {
        "Accept": "application/json"
      }
    });
    const settings = await response.json();

    if (!response.ok) {
      throw new Error("Appointment booking settings could not be loaded.");
    }

    renderAppointmentBooking(settings);
  } catch (error) {
    console.warn(error);
    renderAppointmentBooking(defaultAppointmentSettings);
  }
};

const setupBookingForm = () => {
  if (!bookingForm) {
    return;
  }

  const status = bookingForm.querySelector("[data-booking-status]");
  const submitButton = bookingForm.querySelector("button[type='submit']");

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(bookingForm);
    const payload = Object.fromEntries(formData.entries());

    if (status) {
      status.classList.remove("error");
      status.textContent = "Sending your booking request...";
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch(bookingForm.action, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Booking request could not be completed.");
      }

      bookingForm.reset();

      if (status) {
        status.textContent = result.message || "Booking request sent. We will follow up to confirm the appointment.";
      }
    } catch (error) {
      console.warn(error);

      if (status) {
        status.classList.add("error");
        status.textContent = "Booking request could not be completed online. Your email app will open so you can send it directly.";
      }

      window.location.href = buildBookingEmail(payload);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
};

const initNetlifyIdentityRedirect = () => {
  if (!window.netlifyIdentity) {
    return;
  }

  window.netlifyIdentity.on("init", (user) => {
    if (!user) {
      window.netlifyIdentity.on("login", () => {
        document.location.href = "/admin/";
      });
    }
  });
};

const loadNetlifyIdentityWidget = () => {
  if (window.netlifyIdentity) {
    initNetlifyIdentityRedirect();
    return;
  }

  const script = document.createElement("script");
  script.src = "https://identity.netlify.com/v1/netlify-identity-widget.js";
  script.onload = initNetlifyIdentityRedirect;
  document.head.append(script);
};

loadServices();
loadAppointmentBooking();
setupBookingForm();
loadNetlifyIdentityWidget();
