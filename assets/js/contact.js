// File: assets/js/contact.js
(function () {
  const form = document.querySelector("#contactForm");
  if (!form) return;
  const submitBtn = document.getElementById("submit-button");
  const statusEl = document.getElementById("contact-status");

  window.enableSubmit = function () {
    try { if (submitBtn) submitBtn.disabled = false; } catch {}
  };

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", !!isError);
    statusEl.classList.toggle("success", !isError);
  }

  const endpointAttr = form.getAttribute("action") || "api/contact";
  let base = "";
  if (location.hostname.endsWith("github.io")) base = "https://www.humstudios.com/";
  const endpointUrl = new URL(endpointAttr, base || window.location.origin).toString();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("");
    const tsInput = form.querySelector('input[name="cf-turnstile-response"]');
    if (tsInput && !tsInput.value) { setStatus("Please complete the Turnstile check.", true); return; }
    const name = (form.querySelector('#name')?.value || "").trim();
    const email = (form.querySelector('#email')?.value || "").trim();
    const message = (form.querySelector('#message')?.value || "").trim();
    if (!name || !email || !message) { setStatus("Please fill out your name, email, and message.", true); return; }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.textContent || submitBtn.value || "";
      if (submitBtn.tagName === "BUTTON") submitBtn.textContent = "Sending…";
      if (submitBtn.tagName === "INPUT") submitBtn.value = "Sending…";
    }

    try {
      const fd = new FormData(form);
      const res = await fetch(endpointUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Accept": "application/json", "X-Requested-With": "hum-contact" },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const err = (data && (data.error || data.detail)) || res.statusText;
        setStatus("Sorry, that didn’t send. " + (err || "Please try again."), true);
        if (submitBtn) submitBtn.disabled = false;
      } else {
        setStatus("Thanks! Your message has been sent.", false);
        form.reset();
        if (window.turnstile) {
          try {
            const widget = form.querySelector(".cf-turnstile");
            if (widget) window.turnstile.reset(widget);
          } catch {}
        }
        if (submitBtn) submitBtn.disabled = true;
      }
    } catch (err) {
      setStatus("Network error. Please try again.", true);
      if (submitBtn) submitBtn.disabled = false;
    } finally {
      if (submitBtn && submitBtn.dataset.originalText) {
        if (submitBtn.tagName === "BUTTON") submitBtn.textContent = submitBtn.dataset.originalText;
        if (submitBtn.tagName === "INPUT") submitBtn.value = submitBtn.dataset.originalText;
      }
    }
  });
})();