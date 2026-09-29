import { escapeHtml } from './util.js';

const MENU_MAX_HEIGHT = 220;
const MENU_GAP = 4;

/** Wires the custom +/- buttons of a `.num-field` to its number input. */
export function wireStepper(field) {
  const input = field.querySelector('input');
  const step = (delta) => {
    const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
    input.value = Math.max(min, (parseFloat(input.value) || 0) + delta);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  field.querySelector('.num-up').addEventListener('click', () => step(1));
  field.querySelector('.num-down').addEventListener('click', () => step(-1));
}

// Only one dropdown menu is open at a time. The menu lives on <body> while open, so it is
// never clipped by scrolling or overflow:hidden containers.
let openMenu = null;

export function closeOpenSelect() {
  openMenu?.close();
}

document.addEventListener('click', (e) => {
  if (openMenu && !openMenu.wrap.contains(e.target) && !openMenu.menu.contains(e.target)) closeOpenSelect();
});
window.addEventListener('resize', () => openMenu?.position());
document.addEventListener('scroll', () => openMenu?.position(), true);

/** Replaces the native <select> popup with a styled dropdown; the <select> stays the source of truth. */
export function enhanceSelect(select) {
  if (select.closest('.csel')) return;

  const menuClass = select.closest('.src-body') ? ' csel-menu-src' : select.closest('.panel-compact') ? ' csel-menu-compact' : '';
  const wrap = document.createElement('div');
  wrap.className = 'csel';
  select.replaceWith(wrap);
  wrap.appendChild(select);
  select.classList.add('csel-native');

  wrap.insertAdjacentHTML('beforeend', `
    <button type="button" class="csel-trigger">
      <span class="label-wrap"><span class="label"></span></span><span class="arrow"></span>
    </button>`);
  const trigger = wrap.querySelector('.csel-trigger');

  const syncLabel = () => {
    trigger.querySelector('.label').textContent = select.options[select.selectedIndex]?.textContent ?? '';
  };

  function open() {
    closeOpenSelect();

    const menu = document.createElement('div');
    menu.className = `csel-menu open${menuClass}`;
    const list = document.createElement('div');
    list.className = 'csel-menu-scroll';
    list.innerHTML = [...select.options]
      .map((opt, i) => `<div class="csel-option${i === select.selectedIndex ? ' selected' : ''}" data-index="${i}"><span>${escapeHtml(opt.textContent)}</span></div>`)
      .join('');
    menu.appendChild(list);
    document.body.appendChild(menu);
    wrap.classList.add('open');

    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const height = Math.min(MENU_MAX_HEIGHT, list.scrollHeight + 8);
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const openUp = below < height && above > below;
      const maxHeight = Math.min(MENU_MAX_HEIGHT, openUp ? above : below);

      Object.assign(menu.style, {
        left: `${Math.max(4, Math.min(rect.left, window.innerWidth - rect.width - 4))}px`,
        width: `${rect.width}px`,
        top: openUp ? 'auto' : `${rect.bottom + MENU_GAP}px`,
        bottom: openUp ? `${window.innerHeight - rect.top + MENU_GAP}px` : 'auto',
        maxHeight: `${maxHeight}px`
      });
      list.style.maxHeight = `${maxHeight - 8}px`;
    };

    const close = () => {
      menu.remove();
      wrap.classList.remove('open');
      if (openMenu?.menu === menu) openMenu = null;
    };

    list.addEventListener('click', (e) => {
      const option = e.target.closest('.csel-option');
      if (!option) return;
      select.selectedIndex = Number(option.dataset.index);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncLabel();
      close();
    });
    list.addEventListener('wheel', (e) => {
      e.stopPropagation();
      const atTop = list.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom) e.preventDefault();
    }, { passive: false });

    openMenu = { wrap, menu, position, close };
    position();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wrap.classList.contains('open')) closeOpenSelect();
    else open();
  });

  syncLabel();
}
