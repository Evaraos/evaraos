export function renderListBatch(container, rows, renderItem, options = {}) {
  if (!container || typeof renderItem !== 'function') return;

  const batchSize = Number(options.batchSize || 20);
  const maxItems = Number(options.maxItems || 100);
  const emptyHTML = options.emptyHTML || '<div class="item muted">No records found.</div>';
  const safeRows = Array.isArray(rows) ? rows.slice(0, maxItems) : [];

  container.innerHTML = '';

  if (!safeRows.length) {
    container.innerHTML = emptyHTML;
    return;
  }

  let index = 0;

  function paint() {
    const fragment = document.createDocumentFragment();
    const end = Math.min(index + batchSize, safeRows.length);

    for (; index < end; index += 1) {
      const node = renderItem(safeRows[index], index);

      if (typeof node === 'string') {
        const shell = document.createElement('div');
        shell.innerHTML = node;
        while (shell.firstChild) fragment.appendChild(shell.firstChild);
      } else if (node instanceof Node) {
        fragment.appendChild(node);
      }
    }

    container.appendChild(fragment);

    if (index < safeRows.length) {
      requestAnimationFrame(paint);
    }
  }

  requestAnimationFrame(paint);
}

export function runWhenIdle(callback, timeout = 700) {
  if (typeof callback !== 'function') return;

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout });
    return;
  }

  setTimeout(callback, 32);
}

export function lazyHydrate(selector, callback, options = {}) {
  const nodes = [...document.querySelectorAll(selector)];
  if (!nodes.length || typeof callback !== 'function') return () => {};

  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => callback(node));
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      callback(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: options.rootMargin || '180px 0px',
    threshold: Number(options.threshold || 0.01)
  });

  nodes.forEach((node) => observer.observe(node));

  return () => observer.disconnect();
}

export function createElementFromHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '').trim();
  return template.content.firstElementChild;
}
