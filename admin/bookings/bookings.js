const tokenKey = "clecleanBookingAdminToken";
const statuses = ["pending", "confirmed", "declined", "completed"];

const state = {
  token: sessionStorage.getItem(tokenKey) || "",
  filter: "all",
  bookings: [],
  selectedId: ""
};

const accessPanel = document.querySelector("[data-access-panel]");
const accessForm = document.querySelector("[data-access-form]");
const accessMessage = document.querySelector("[data-access-message]");
const workspace = document.querySelector("[data-workspace]");
const rows = document.querySelector("[data-booking-rows]");
const detailsPanel = document.querySelector("[data-details-panel]");
const filterButtons = document.querySelectorAll("[data-status-filter]");
const refreshButton = document.querySelector("[data-refresh]");
const toast = document.querySelector("[data-toast]");

const statusLabel = (status) => {
  return statuses.includes(status) ? status : "pending";
};

const escapeHtml = (value) => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatDateTime = (booking) => {
  if (!booking.date && !booking.time) {
    return "No time provided";
  }

  return [booking.date, booking.time].filter(Boolean).join(" at ");
};

const showToast = (message, isError = false) => {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 3600);
};

const setAccessState = (isAuthorized) => {
  accessPanel.hidden = isAuthorized;
  workspace.hidden = !isAuthorized;
};

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${state.token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
};

const renderRows = () => {
  if (!state.bookings.length) {
    rows.innerHTML = `<tr><td colspan="4">No bookings found.</td></tr>`;
    detailsPanel.innerHTML = `
      <div class="empty-state">
        <h2>No bookings</h2>
        <p>Try another status filter.</p>
      </div>
    `;
    return;
  }

  rows.innerHTML = state.bookings.map((booking) => `
    <tr data-booking-id="${escapeHtml(booking.id)}" class="${booking.id === state.selectedId ? "selected" : ""}">
      <td>
        <div class="customer">
          <strong>${escapeHtml(booking.name)}</strong>
          <span>${escapeHtml(booking.email)}</span>
          <span>${escapeHtml(booking.phone)}</span>
        </div>
      </td>
      <td>
        <strong>${escapeHtml(booking.service)}</strong>
        <div class="subtle">${escapeHtml(booking.vehicle)}</div>
      </td>
      <td>
        <strong>${escapeHtml(formatDateTime(booking))}</strong>
        <div class="subtle">${escapeHtml(booking.city)}</div>
      </td>
      <td><span class="status-pill ${escapeHtml(statusLabel(booking.status))}">${escapeHtml(statusLabel(booking.status))}</span></td>
    </tr>
  `).join("");
};

const detailRow = (label, value) => `
  <div class="detail-row">
    <span>${escapeHtml(label)}</span>
    <p>${escapeHtml(value || "Not provided")}</p>
  </div>
`;

const renderDetails = () => {
  const booking = state.bookings.find((item) => item.id === state.selectedId);

  if (!booking) {
    detailsPanel.innerHTML = `
      <div class="empty-state">
        <h2>Select a booking</h2>
        <p>Choose a row to open the request details.</p>
      </div>
    `;
    return;
  }

  const canConfirm = booking.status !== "confirmed";
  const canDecline = booking.status !== "declined";
  const canComplete = booking.status !== "completed";

  detailsPanel.innerHTML = `
    <div class="details-head">
      <span class="status-pill ${escapeHtml(statusLabel(booking.status))}">${escapeHtml(statusLabel(booking.status))}</span>
      <h2>${escapeHtml(booking.name)}</h2>
      <p class="subtle">${escapeHtml(formatDateTime(booking))}</p>
    </div>
    <div class="details-actions">
      <button type="button" class="confirm" data-next-status="confirmed" ${canConfirm ? "" : "disabled"}>Confirm</button>
      <button type="button" class="decline" data-next-status="declined" ${canDecline ? "" : "disabled"}>Decline</button>
      <button type="button" class="complete" data-next-status="completed" ${canComplete ? "" : "disabled"}>Complete</button>
    </div>
    <div class="details-body">
      ${detailRow("Email", booking.email)}
      ${detailRow("Phone", booking.phone)}
      ${detailRow("Service", booking.service)}
      ${detailRow("Vehicle", booking.vehicle)}
      ${detailRow("Address", `${booking.address}, ${booking.city}`)}
      ${detailRow("Notes", booking.notes)}
      ${detailRow("Created", booking.createdAt)}
      ${detailRow("Updated", booking.updatedAt)}
    </div>
  `;
};

const selectBooking = (id) => {
  state.selectedId = id;
  renderRows();
  renderDetails();
};

const loadBookings = async () => {
  rows.innerHTML = `<tr><td colspan="4">Loading bookings...</td></tr>`;

  const query = state.filter === "all" ? "" : `?status=${encodeURIComponent(state.filter)}`;
  const payload = await apiFetch(`/api/bookings${query}`);
  state.bookings = payload.bookings || [];

  if (!state.bookings.some((booking) => booking.id === state.selectedId)) {
    state.selectedId = state.bookings[0]?.id || "";
  }

  renderRows();
  renderDetails();
};

const updateStatus = async (status) => {
  const booking = state.bookings.find((item) => item.id === state.selectedId);

  if (!booking) {
    return;
  }

  const payload = await apiFetch(`/api/bookings/${encodeURIComponent(booking.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  const updatedBooking = payload.booking;
  const index = state.bookings.findIndex((item) => item.id === updatedBooking.id);

  if (index !== -1) {
    state.bookings[index] = updatedBooking;
  }

  if (state.filter !== "all" && updatedBooking.status !== state.filter) {
    state.bookings = state.bookings.filter((item) => item.id !== updatedBooking.id);
    state.selectedId = state.bookings[0]?.id || "";
  }

  renderRows();
  renderDetails();
  showToast(`Booking ${status}.`);
};

const authorize = async (token) => {
  state.token = token.trim();
  await loadBookings();
  sessionStorage.setItem(tokenKey, state.token);
  setAccessState(true);
};

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(accessForm);
  accessMessage.textContent = "";

  try {
    await authorize(String(formData.get("token") || ""));
  } catch (error) {
    sessionStorage.removeItem(tokenKey);
    state.token = "";
    accessMessage.textContent = error.message;
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    state.filter = button.dataset.statusFilter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));

    try {
      await loadBookings();
    } catch (error) {
      showToast(error.message, true);
    }
  });
});

rows.addEventListener("click", (event) => {
  const row = event.target.closest("[data-booking-id]");

  if (row) {
    selectBooking(row.dataset.bookingId);
  }
});

detailsPanel.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-next-status]");

  if (!button || button.disabled) {
    return;
  }

  button.disabled = true;

  try {
    await updateStatus(button.dataset.nextStatus);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

refreshButton.addEventListener("click", async () => {
  try {
    await loadBookings();
    showToast("Bookings refreshed.");
  } catch (error) {
    showToast(error.message, true);
  }
});

if (state.token) {
  authorize(state.token).catch((error) => {
    sessionStorage.removeItem(tokenKey);
    state.token = "";
    setAccessState(false);
    accessMessage.textContent = error.message;
  });
} else {
  setAccessState(false);
}
