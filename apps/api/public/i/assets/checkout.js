(function () {
  const root = document.querySelector('.checkout');
  const publicId = root.dataset.publicId;
  const statusEl = document.getElementById('status');
  const statusLabel = document.getElementById('status-label');
  const confirmationsEl = document.getElementById('confirmations');

  const TERMINAL_STATUSES = ['confirmed', 'expired', 'cancelled'];
  const POLL_INTERVAL_MS = 8_000;

  async function poll() {
    try {
      const res = await fetch(`/i/${publicId}/status`);
      if (res.ok) {
        const data = await res.json();
        statusEl.dataset.status = data.status;
        statusLabel.textContent = `Status: ${data.status}`;
        confirmationsEl.textContent = `${data.confirmations} / ${data.confirmationsRequired} confirmations`;

        if (TERMINAL_STATUSES.includes(data.status)) {
          return;
        }
      }
    } catch {
      // network hiccup, just retry next tick
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  }

  function bindCopy(buttonId, textId) {
    const btn = document.getElementById(buttonId);
    const el = document.getElementById(textId);
    if (!btn || !el) return;
    // Rendered hidden so no-JS visitors don't see a dead button; the value
    // itself is still one-click selectable via CSS user-select: all.
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(el.textContent.trim());
      const original = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = original), 1500);
    });
  }

  // Server renders the expiry in UTC; show it in the visitor's time zone.
  function localiseExpiry() {
    const el = document.getElementById('expires');
    const date = el && new Date(el.getAttribute('datetime'));
    if (!date || Number.isNaN(date.getTime())) return;
    el.textContent = date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  localiseExpiry();
  bindCopy('copy-address', 'address');
  bindCopy('copy-amount', 'amount');

  poll();
})();
