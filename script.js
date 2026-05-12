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
const bookingForm = document.querySelector("[data-booking-form]");
const calUsername = "brendon-vo-ma5r9m";
const calOrigin = "https://cal.com";
const calProfileUrl = `${calOrigin}/${calUsername}`;
const calEventTypesEndpoint = `https://api.cal.com/v2/event-types?username=${encodeURIComponent(calUsername)}&sortCreatedAt=asc`;
let calServiceList = document.querySelector("[data-cal-service-list]");
let calServiceInput = document.querySelector("[data-cal-service-input]");

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

const ensureCalServiceStyles = () => {
  if (document.querySelector("[data-cal-service-styles]")) {
    return;
  }

  const styles = document.createElement("style");
  styles.dataset.calServiceStyles = "";
  styles.textContent = `
    .cal-service-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .cal-service-list>p{grid-column:1/-1;margin:0;color:var(--muted);font-weight:700}
    .cal-service-option{display:grid;gap:5px;min-height:78px;width:100%;padding:14px;border:1px solid var(--line);border-radius:6px;background:#fbfcfa;color:var(--ink);font:inherit;text-align:left;cursor:pointer;transition:border-color 180ms ease,box-shadow 180ms ease,transform 180ms ease}
    .cal-service-option span{font-weight:900}
    .cal-service-option small,.cal-service-option em{color:var(--muted);font-size:.9rem;font-style:normal;font-weight:700}
    .cal-service-option:hover,.cal-service-option:focus-visible{border-color:var(--green);box-shadow:0 10px 24px rgba(16,19,23,.1);outline:none;transform:translateY(-1px)}
    @media (max-width:860px){.cal-service-list{grid-template-columns:1fr}}
  `;
  document.head.append(styles);
};

const loadServices = async () => {
  if (!document.querySelector(servicesGridSelector)) {
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
  } catch (error) {
    console.warn(error);
  }
};

const getFieldLabel = (fieldName) => {
  return bookingForm?.querySelector(`[name="${fieldName}"]`)?.closest("label") || null;
};

const removeField = (fieldName) => {
  getFieldLabel(fieldName)?.remove();
};

const ensureWaterPowerAccessField = () => {
  if (!bookingForm || bookingForm.querySelector("[name='water_power_access']")) {
    return;
  }

  const accessLine = document.createElement("label");
  accessLine.className = "consent-line";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = "water_power_access";
  checkbox.value = "yes";
  checkbox.required = true;

  const text = document.createElement("span");
  text.textContent = "I can provide access to water and power at the service location.";

  accessLine.append(checkbox, text);

  const consentLine = bookingForm.querySelector(".consent-line");
  const honeyField = bookingForm.querySelector(".honey-field");

  if (consentLine) {
    consentLine.after(accessLine);
  } else if (honeyField) {
    honeyField.before(accessLine);
  } else {
    bookingForm.append(accessLine);
  }
};

const ensureCalServicePicker = () => {
  if (!bookingForm) {
    return;
  }

  ensureWaterPowerAccessField();

  if (!calServiceInput) {
    calServiceInput = document.createElement("input");
    calServiceInput.type = "hidden";
    calServiceInput.name = "service";
    calServiceInput.dataset.calServiceInput = "";
    bookingForm.prepend(calServiceInput);
  }

  const existingServiceSelect = bookingForm.querySelector("select[name='service']");

  if (existingServiceSelect) {
    existingServiceSelect.closest("label")?.remove();
  }

  if (!calServiceList) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "booking-slot-field wide-field";
    fieldset.dataset.calServiceField = "";

    const legend = document.createElement("legend");
    legend.textContent = "Choose service and book live availability";

    calServiceList = document.createElement("div");
    calServiceList.className = "cal-service-list";
    calServiceList.dataset.calServiceList = "";
    const loading = document.createElement("p");
    loading.textContent = "Loading live Cal.com services...";
    calServiceList.append(loading);

    fieldset.append(legend, calServiceList);

    const notesLabel = getFieldLabel("notes");
    const timeLabel = getFieldLabel("time");
    const formGrid = bookingForm.querySelector(".form-grid");

    if (notesLabel) {
      notesLabel.after(fieldset);
    } else if (timeLabel) {
      timeLabel.after(fieldset);
    } else {
      formGrid?.append(fieldset);
    }
  }

  removeField("date");
  removeField("time");
  bookingForm.querySelector("button[type='submit']")?.remove();
  ensureCalServiceStyles();
};

const formatDuration = (minutes) => {
  const totalMinutes = Number(minutes);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "";
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const parts = [];

  if (hours) {
    parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  }

  if (remainingMinutes) {
    parts.push(`${remainingMinutes} min`);
  }

  return parts.join(" ");
};

const normalizeCalEventTypes = (data) => {
  const eventTypes = Array.isArray(data?.data) ? data.data : [];

  return eventTypes
    .filter((eventType) => {
      return eventType
        && eventType.hidden !== true
        && eventType.bookingRequiresAuthentication !== true
        && String(eventType.title || "").trim()
        && String(eventType.slug || "").trim();
    })
    .map((eventType) => ({
      title: String(eventType.title || "").trim(),
      slug: String(eventType.slug || "").trim(),
      description: String(eventType.description || "").trim(),
      duration: formatDuration(eventType.lengthInMinutes),
      bookingUrl: eventType.bookingUrl || `${calProfileUrl}/${eventType.slug}`
    }));
};

const getBookingPayload = () => Object.fromEntries(new FormData(bookingForm).entries());

const setUrlParam = (url, name, value) => {
  const cleanedValue = String(value || "").trim();

  if (cleanedValue) {
    url.searchParams.set(name, cleanedValue);
  }
};

const buildCalBookingUrl = (service) => {
  const payload = getBookingPayload();
  const url = new URL(service.bookingUrl);
  const notes = [
    payload.notes,
    `Vehicle: ${payload.vehicle || ""}`,
    `Street Address: ${payload.address || ""}`,
    `City: ${payload.city || ""}`,
    `Phone: ${payload.phone || ""}`,
    payload.water_power_access ? "Water and power access: Confirmed" : ""
  ].filter((value) => String(value || "").trim()).join("\n");

  setUrlParam(url, "name", payload.name);
  setUrlParam(url, "email", payload.email);
  setUrlParam(url, "attendeePhoneNumber", payload.phone);
  setUrlParam(url, "phone", payload.phone);
  setUrlParam(url, "vehicle", payload.vehicle);
  setUrlParam(url, "address", payload.address);
  setUrlParam(url, "city", payload.city);
  setUrlParam(url, "notes", notes);
  setUrlParam(url, "utm_source", "cleveland-clean-website");
  setUrlParam(url, "utm_medium", "booking-section");

  return url;
};

const renderCalServiceMessage = (message, includeLink = false) => {
  if (!calServiceList) {
    return;
  }

  const paragraph = document.createElement("p");
  paragraph.textContent = message;

  if (includeLink) {
    paragraph.append(" ");
    const link = document.createElement("a");
    link.href = calProfileUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open Cal.com";
    paragraph.append(link);
  }

  calServiceList.replaceChildren(paragraph);
};

const openCalService = (service) => {
  if (!bookingForm.reportValidity()) {
    return;
  }

  if (calServiceInput) {
    calServiceInput.value = service.title;
  }

  const status = bookingForm.querySelector("[data-booking-status]");
  const url = buildCalBookingUrl(service);

  if (status) {
    status.classList.remove("error");
    status.textContent = `Opening live availability for ${service.title}...`;
  }

  const newWindow = window.open(url.toString(), "_blank");

  if (newWindow) {
    newWindow.opener = null;
  } else {
    window.location.href = url.toString();
  }
};

const calServiceButton = (service) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cal-service-option";
  button.dataset.calServiceSlug = service.slug;

  appendText(button, "span", service.title);
  appendText(button, "small", service.duration || "Live availability");

  if (service.description) {
    appendText(button, "em", service.description);
  }

  button.addEventListener("click", () => {
    openCalService(service);
  });

  return button;
};

const renderCalServices = (services) => {
  if (!calServiceList) {
    return;
  }

  if (!services.length) {
    renderCalServiceMessage("No Cal.com services are currently available.", true);
    return;
  }

  calServiceList.replaceChildren(...services.map(calServiceButton));
};

const loadCalServices = async () => {
  if (!calServiceList) {
    return;
  }

  try {
    const response = await fetch(calEventTypesEndpoint, {
      headers: {
        "Accept": "application/json",
        "cal-api-version": "2024-06-14"
      }
    });
    const data = await response.json();

    if (!response.ok || data?.status === "error") {
      throw new Error("Cal.com services could not be loaded.");
    }

    renderCalServices(normalizeCalEventTypes(data));
  } catch (error) {
    console.warn(error);
    renderCalServiceMessage("Live scheduling could not be loaded.", true);
  }
};

const setupBookingForm = () => {
  if (!bookingForm) {
    return;
  }

  const status = bookingForm.querySelector("[data-booking-status]");

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (status) {
      status.classList.add("error");
      status.textContent = "Choose a detailing service to view live Cal.com availability.";
    }

    if (calServiceList) {
      calServiceList.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
};

loadServices();
ensureCalServicePicker();
loadCalServices();
setupBookingForm();
