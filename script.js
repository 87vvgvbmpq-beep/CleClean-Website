const comparisons = document.querySelectorAll("[data-comparison]");

comparisons.forEach((comparison) => {
  const range = comparison.querySelector("[data-range]");
  const beforeWrap = comparison.querySelector("[data-before-wrap]");
  const handle = comparison.querySelector("[data-handle]");

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

const quoteForm = document.querySelector(".quote-form");

if (quoteForm) {
  const interestFields = quoteForm.querySelectorAll('input[name="Interested In"]');

  const validateInterest = () => {
    const hasSelection = Array.from(interestFields).some((field) => field.checked);
    interestFields[0].setCustomValidity(hasSelection ? "" : "Please choose at least one service.");
  };

  interestFields.forEach((field) => {
    field.addEventListener("change", validateInterest);
  });

  quoteForm.addEventListener("submit", validateInterest);
}
