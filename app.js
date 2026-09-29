const event = window.__EVENT__;
const youtubeUrl = event.youtubeUrl;
const dialog = document.getElementById('signup-dialog');
const stickyCta = document.getElementById('mobile-sticky-cta');
const heroCta = document.querySelector('.hero-actions [data-open-signup]');
const finalSection = document.querySelector('.final-section');
let registrationReady = false;

function updateStickyCta() {
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const heroPassed = heroCta.getBoundingClientRect().bottom < 0;
  const finalVisible = finalSection.getBoundingClientRect().top < window.innerHeight;
  stickyCta.hidden = !isMobile || !heroPassed || finalVisible || dialog.open;
}

window.addEventListener('scroll', updateStickyCta, { passive: true });
window.addEventListener('resize', updateStickyCta);
dialog.addEventListener('close', updateStickyCta);
updateStickyCta();

async function checkRegistration() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    registrationReady = Boolean(status.registrationEnabled);
    if (registrationReady) {
      dialog.querySelector('.integration-note').hidden = true;
      dialog.querySelector('.form-submit').disabled = false;
    }
  } catch {
    // A static file preview keeps the form visible, but does not accept submissions.
  }
}
checkRegistration();

for (const button of document.querySelectorAll('[data-open-signup]')) {
  button.addEventListener('click', () => {
    dialog.showModal();
    updateStickyCta();
    dialog.querySelector('input[name="name"]')?.focus();
  });
}
dialog.querySelector('[data-close-signup]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (clickEvent) => { if (clickEvent.target === dialog) dialog.close(); });

function maskPhone(value) {
  const digits = value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const prefix = digits.length > 10 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 2 + prefix)}-${digits.slice(2 + prefix)}`;
}

function validate(form) {
  let valid = true;
  const messages = {
    name: (value) => value.trim().length >= 2 ? '' : 'Digite seu nome.',
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Digite um e-mail válido.',
    whatsapp: (value) => /^\d{10,11}$/.test(value.replace(/\D/g, '')) ? '' : 'Digite um WhatsApp válido com DDD.',
  };
  for (const [name, check] of Object.entries(messages)) {
    const field = form.elements[name];
    const message = check(field.value);
    field.setAttribute('aria-invalid', String(Boolean(message)));
    const error = document.getElementById(`${field.id}-error`);
    error.textContent = message;
    if (message) valid = false;
  }
  if (!valid) form.querySelector('[aria-invalid="true"]')?.focus();
  return valid;
}

for (const form of document.querySelectorAll('[data-lead-form]')) {
  const phone = form.elements.whatsapp;
  phone.addEventListener('input', () => { phone.value = maskPhone(phone.value); });
  for (const name of ['name', 'email', 'whatsapp']) {
    const field = form.elements[name];
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') {
        field.setAttribute('aria-invalid', 'false');
        document.getElementById(`${field.id}-error`).textContent = '';
      }
    });
  }
  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const status = form.querySelector('.form-status');
    status.textContent = '';
    status.dataset.state = '';
    if (!registrationReady) {
      status.textContent = 'O envio ainda não está disponível. Acompanhe a live pelo YouTube.';
      status.dataset.state = 'error';
      return;
    }
    if (!validate(form)) return;
    const button = form.querySelector('.form-submit');
    button.disabled = true;
    button.textContent = 'Confirmando cadastro…';
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), whatsapp: form.elements.whatsapp.value, website: form.elements.website.value }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Não foi possível confirmar o cadastro. Tente novamente.');
      form.innerHTML = `<div class="form-success"><span class="success-mark" aria-hidden="true">✓</span><h2 id="signup-title">Cadastro confirmado.</h2><p>Perfeito. Você será avisado quando a live começar.</p><a class="button button-primary" href="${youtubeUrl}" target="_blank" rel="noopener noreferrer">Ir para o YouTube</a></div>`;
    } catch (error) {
      status.textContent = error.message || 'Não foi possível confirmar o cadastro. Tente novamente.';
      status.dataset.state = 'error';
      button.disabled = false;
      button.innerHTML = 'Quero ser notificado <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
  });
}

function updateCountdown() {
  const now = Date.now();
  const start = new Date(event.dateTime).getTime();
  const end = new Date(event.endTime).getTime();
  const status = document.getElementById('countdown-status');
  const countdown = document.getElementById('countdown');
  const liveLink = document.getElementById('event-live-link');
  if (now >= start) {
    countdown.hidden = true;
    liveLink.hidden = false;
    if (now < end) {
      status.textContent = 'Ao vivo agora';
      liveLink.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6V4Z" fill="currentColor"/></svg> Assistir agora';
    } else {
      status.textContent = 'Transmissão encerrada';
      liveLink.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6V4Z" fill="currentColor"/></svg> Ver no YouTube';
    }
    return;
  }
  const remaining = Math.max(0, Math.floor((start - now) / 1000));
  const parts = {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
  };
  for (const [unit, value] of Object.entries(parts)) document.querySelector(`[data-unit="${unit}"]`).textContent = String(value).padStart(2, '0');
}
updateCountdown();
setInterval(updateCountdown, 1000);
