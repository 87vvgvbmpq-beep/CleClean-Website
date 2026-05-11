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
const servicesGridSelector = "[data-services-grid], .service-grid";
const servicesSelectSelector = "[data-services-select], select[name='service']";
const bookingForm = document.querySelector("[data-booking-form]");
const bookingFallbackEmail = "bookings@clevelandcleandetailing.com";

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
setupBookingForm();
loadNetlifyIdentityWidget();
