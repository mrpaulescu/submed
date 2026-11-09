(() => {
  const panels = [...document.querySelectorAll('[data-panel]')];
  const steps = [...document.querySelectorAll('[data-step]')];
  const prev = document.getElementById('wtPrev');
  const next = document.getElementById('wtNext');
  const count = document.getElementById('wtCount');
  const hint = document.getElementById('wtHint');
  const progress = document.getElementById('wtProgress');
  const complete = document.getElementById('wtComplete');
  if (!panels.length || !steps.length || !prev || !next) return;

  let current = 0;
  const total = panels.length;
  const pad = n => String(n).padStart(2, '0');

  function show(index, moveFocus = false) {
    current = Math.max(0, Math.min(total - 1, index));
    panels.forEach((panel, i) => {
      const active = i === current;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    steps.forEach((step, i) => {
      const active = i === current;
      step.classList.toggle('is-active', active);
      step.setAttribute('aria-current', active ? 'step' : 'false');
    });
    count.textContent = `${pad(current + 1)} / ${pad(total)}`;
    hint.textContent = `Pasul ${current + 1} din ${total}`;
    progress.style.width = `${((current + 1) / total) * 100}%`;
    prev.disabled = current === 0;
    next.innerHTML = current === total - 1 ? 'Reia turul <span>↻</span>' : 'Următorul pas <span>→</span>';
    complete.hidden = current !== total - 1;
    if (moveFocus) {
      document.querySelector('.wt-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
      next.focus({ preventScroll: true });
    }
    const url = new URL(location.href);
    url.searchParams.set('pas', String(current + 1));
    history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  steps.forEach(step => step.addEventListener('click', () => show(Number(step.dataset.step), true)));
  prev.addEventListener('click', () => show(current - 1, true));
  next.addEventListener('click', () => show(current === total - 1 ? 0 : current + 1, true));
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight') show(current + 1);
    if (event.key === 'ArrowLeft') show(current - 1);
  });

  const requested = Number(new URLSearchParams(location.search).get('pas'));
  show(Number.isInteger(requested) && requested > 0 ? requested - 1 : 0);
})();