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

const bookingForm = document.querySelector("[data-booking-form]");
const bookingFallbackEmail = "bookings@clevelandcleandetailing.com";
const bookingFallbackPhone = "(216) 659-1510";
const availabilityEndpoint = "/.netlify/functions/get-availability";

const buildBookingEmail = (payload) => {
  const subject = `Booking request from ${payload.name || "website visitor"}`;
  const body = [
    "New booking request from the Cleveland Clean website:",
    "",
    `Name: ${payload.name || ""}`,
    `Email: ${payload.email || ""}`,
    `Phone: ${payload.phone || ""}`,
    `Service: ${payload.service || ""}`,
    `Vehicle: ${payload.vehicle || ""}`,
    `Selected slot: ${payload.slotLabel || ""}`,
    `Preferred date: ${payload.date || ""}`,
    `Preferred time: ${payload.time || ""}`,
    `Address: ${payload.address || ""}`,
    `City: ${payload.city || ""}`,
    `Notes: ${payload.notes || "None"}`
  ].join("\n");

  return `mailto:${bookingFallbackEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

if (bookingForm) {
  const status = bookingForm.querySelector("[data-booking-status]");
  const submitButton = bookingForm.querySelector("button[type='submit']");
  const ensureSlotStyles = () => {
    if (document.querySelector("[data-booking-slot-styles]")) {
      return;
    }

    const styles = document.createElement("style");
    styles.dataset.bookingSlotStyles = "";
    styles.textContent = `
      .booking-slot-field{display:grid;gap:12px;margin:0;padding:0;border:0;min-width:0}
      .booking-slot-field legend{margin:0 0 7px;color:var(--muted);text-transform:uppercase;font-size:.76rem;font-weight:800}
      .slot-list{display:grid;gap:10px}
      .slot-list>p{margin:0;color:var(--muted);font-weight:700}
      .slot-option{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;min-height:58px;padding:12px;border:1px solid var(--line);border-radius:6px;background:#fbfcfa}
      .slot-option input{grid-row:span 2;width:18px;min-width:18px;min-height:18px;accent-color:var(--green)}
      .slot-option span{font-weight:900}
      .slot-option small{color:var(--muted);font-weight:700}
    `;
    document.head.append(styles);
  };
  const ensureSlotPicker = () => {
    const existingSlots = bookingForm.querySelector("[data-booking-slots]");
    const existingDate = bookingForm.querySelector("[data-booking-date]") || bookingForm.querySelector("input[name='date']");
    const existingTime = bookingForm.querySelector("[data-booking-time]") || bookingForm.querySelector("input[name='time']");

    if (existingSlots) {
      return {
        slots: existingSlots,
        date: existingDate,
        time: existingTime
      };
    }

    if (!existingDate || !existingTime) {
      return {
        slots: null,
        date: existingDate,
        time: existingTime
      };
    }

    const fieldset = document.createElement("fieldset");
    fieldset.className = "booking-slot-field wide-field";
    const legend = document.createElement("legend");
    legend.textContent = "Available Appointment Times";
    const slotList = document.createElement("div");
    slotList.className = "slot-list";
    slotList.dataset.bookingSlots = "";
    const loading = document.createElement("p");
    loading.textContent = "Loading available times...";
    slotList.append(loading);

    existingDate.type = "hidden";
    existingTime.type = "hidden";
    existingDate.dataset.bookingDate = "";
    existingTime.dataset.bookingTime = "";
    existingDate.removeAttribute("required");
    existingTime.removeAttribute("required");

    const dateLabel = existingDate.closest("label");
    const timeLabel = existingTime.closest("label");
    fieldset.append(legend, existingDate, existingTime, slotList);

    if (dateLabel) {
      dateLabel.replaceWith(fieldset);
    } else {
      bookingForm.querySelector(".form-grid")?.prepend(fieldset);
    }

    if (timeLabel && timeLabel !== dateLabel) {
      timeLabel.remove();
    }

    return {
      slots: slotList,
      date: existingDate,
      time: existingTime
    };
  };
  const slotPicker = ensureSlotPicker();
  const dateInput = slotPicker.date;
  const timeInput = slotPicker.time;
  const slotsContainer = slotPicker.slots;

  ensureSlotStyles();

  if (submitButton) {
    submitButton.textContent = "Book Selected Time";
  }

  const clearSelectedSlot = () => {
    if (dateInput) dateInput.value = "";
    if (timeInput) timeInput.value = "";
  };

  const setSelectedSlot = (slotInput) => {
    if (dateInput) dateInput.value = slotInput.dataset.date || "";
    if (timeInput) timeInput.value = slotInput.dataset.time || "";
  };

  const renderSlots = (slots) => {
    if (!slotsContainer || !submitButton) {
      return;
    }

    slotsContainer.replaceChildren();
    clearSelectedSlot();

    if (!slots.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent = "No available appointment times are posted right now.";
      slotsContainer.append(emptyMessage);
      submitButton.disabled = true;
      return;
    }

    slots.forEach((slot, index) => {
      const label = document.createElement("label");
      label.className = "slot-option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "slotId";
      radio.value = slot.id;
      radio.required = true;
      radio.dataset.date = slot.date || "";
      radio.dataset.time = slot.time || "";
      radio.dataset.label = slot.label || "";

      if (index === 0) {
        radio.checked = true;
        setSelectedSlot(radio);
      }

      const text = document.createElement("span");
      text.textContent = slot.label || "Available appointment";
      const meta = document.createElement("small");
      meta.textContent = slot.title || "Available";

      label.append(radio, text, meta);
      slotsContainer.append(label);
    });

    submitButton.disabled = false;
  };

  const loadAvailability = async () => {
    if (!slotsContainer || !submitButton) {
      return;
    }

    submitButton.disabled = true;
    slotsContainer.replaceChildren();
    const loadingMessage = document.createElement("p");
    loadingMessage.textContent = "Loading available times...";
    slotsContainer.append(loadingMessage);

    try {
      const response = await fetch(availabilityEndpoint, {
        headers: {
          "Accept": "application/json"
        }
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Available appointment times could not be loaded.");
      }

      renderSlots(result.slots || []);
    } catch (error) {
      slotsContainer.replaceChildren();
      const errorMessage = document.createElement("p");
      errorMessage.textContent = error.message;
      slotsContainer.append(errorMessage);
      clearSelectedSlot();
      submitButton.disabled = true;
    }
  };

  if (slotsContainer) {
    slotsContainer.addEventListener("change", (event) => {
      if (event.target?.matches("input[name='slotId']")) {
        setSelectedSlot(event.target);
      }
    });

    loadAvailability();
  }

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!status || !submitButton) {
      bookingForm.submit();
      return;
    }

    const formData = new FormData(bookingForm);
    const payload = Object.fromEntries(formData.entries());
    const selectedSlot = bookingForm.querySelector("input[name='slotId']:checked");

    if (!selectedSlot) {
      status.classList.add("error");
      status.textContent = "Please choose an available appointment time.";
      return;
    }

    setSelectedSlot(selectedSlot);

    payload.consent = formData.get("consent") === "on";
    payload.date = dateInput?.value || "";
    payload.time = timeInput?.value || "";
    payload.slotLabel = selectedSlot.dataset.label || "";
    status.classList.remove("error");
    status.textContent = "Booking your appointment...";
    submitButton.disabled = true;

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
        throw new Error(result.message || "The booking request could not be sent.");
      }

      bookingForm.reset();
      clearSelectedSlot();

      if (slotsContainer) {
        loadAvailability();
      }

      status.textContent = result.message || "Appointment booked. Cleveland Clean will send confirmation soon.";
    } catch (error) {
      const fallbackUrl = buildBookingEmail(payload);
      status.classList.remove("error");
      status.textContent = "Online booking needs a quick email handoff. Your email app is opening with the request filled in.";
      window.location.href = fallbackUrl;

      setTimeout(() => {
        status.classList.add("error");
        status.textContent = `${error.message} If your email app did not open, please call ${bookingFallbackPhone}.`;
      }, 1200);
    } finally {
      submitButton.disabled = !bookingForm.querySelector("input[name='slotId']");
    }
  });
}
