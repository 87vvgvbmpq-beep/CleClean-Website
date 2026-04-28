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

const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

if (bookingForm) {
  const status = bookingForm.querySelector("[data-booking-status]");
  const dateInput = bookingForm.querySelector("[data-booking-date]");
  const submitButton = bookingForm.querySelector("button[type='submit']");

  if (dateInput) {
    dateInput.min = formatDateForInput(new Date());
  }

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!status || !submitButton) {
      bookingForm.submit();
      return;
    }

    const formData = new FormData(bookingForm);
    const payload = Object.fromEntries(formData.entries());

    payload.consent = formData.get("consent") === "on";
    status.classList.remove("error");
    status.textContent = "Sending your booking request...";
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

      if (dateInput) {
        dateInput.min = formatDateForInput(new Date());
      }

      status.textContent = result.message || "Booking request sent. Cleveland Clean will follow up soon.";
    } catch (error) {
      status.classList.add("error");
      status.textContent = `${error.message} Please call (216) 659-1510.`;
    } finally {
      submitButton.disabled = false;
    }
  });
}
