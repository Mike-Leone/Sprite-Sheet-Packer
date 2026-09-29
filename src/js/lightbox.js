import { $ } from './util.js';

const lightbox = $('lightbox');
const image = $('lightboxImg');
const stage = $('lbStage');
const counter = $('lbCounter');

const ZOOM_STEPS = [1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 8];
const SWIPE_DISTANCE = 60;

let scale = 1, tx = 0, ty = 0;
let dragging = false, moved = false, swiped = false;
let lastX = 0, lastY = 0, dragDx = 0;
let gallery = [], index = 0;

function applyTransform() {
  image.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${scale})`;
}

function resetTransform() {
  scale = 1; tx = 0; ty = 0;
  applyTransform();
}

function zoomBy(direction, clientX, clientY) {
  const nearest = ZOOM_STEPS.reduce((best, s, i) =>
    Math.abs(s - scale) < Math.abs(ZOOM_STEPS[best] - scale) ? i : best, 0);
  const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, nearest + direction))];
  if (next === scale) return;

  const rect = stage.getBoundingClientRect();
  const cx = clientX - (rect.left + rect.width / 2);
  const cy = clientY - (rect.top + rect.height / 2);
  const k = next / scale;
  tx = cx - (cx - tx) * k;
  ty = cy - (cy - ty) * k;
  scale = next;
  applyTransform();
}

function show() {
  if (!gallery.length) return;
  image.src = gallery[index].url;
  resetTransform();
  const multi = gallery.length > 1;
  lightbox.classList.toggle('has-nav', multi);
  counter.classList.toggle('hidden', !multi);
  if (multi) counter.textContent = `${index + 1} / ${gallery.length}`;
}

function step(direction) {
  if (gallery.length < 2) return;
  index = (index + direction + gallery.length) % gallery.length;
  show();
}

export function open(items, startIndex) {
  gallery = items;
  index = startIndex;
  show();
  lightbox.classList.add('active');
}

function close() {
  lightbox.classList.remove('active', 'dragging', 'has-nav');
  image.src = '';
  gallery = [];
  resetTransform();
}

function endDrag() {
  if (dragging && Math.abs(dragDx) > SWIPE_DISTANCE && gallery.length > 1) {
    step(dragDx < 0 ? -1 : 1);
    swiped = true;
  }
  dragging = false;
  lightbox.classList.remove('dragging');
}

for (const [id, direction] of [['lbPrev', -1], ['lbNext', 1]]) {
  const btn = $(id);
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    step(direction);
  });
}

lightbox.addEventListener('click', (e) => {
  if (moved || swiped || e.target.closest('.lb-nav')) return;
  close();
});

lightbox.addEventListener('wheel', (e) => {
  if (!lightbox.classList.contains('active')) return;
  e.preventDefault();
  zoomBy(e.deltaY > 0 ? -1 : 1, e.clientX, e.clientY);
}, { passive: false });

lightbox.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  dragging = true; moved = false; swiped = false; dragDx = 0;
  lastX = e.clientX; lastY = e.clientY;
  lightbox.classList.add('dragging');
  lightbox.setPointerCapture(e.pointerId);
});

lightbox.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
  dragDx += dx;
  lastX = e.clientX; lastY = e.clientY;
});

lightbox.addEventListener('pointerup', endDrag);
lightbox.addEventListener('pointercancel', endDrag);
lightbox.addEventListener('dragstart', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  switch (e.key) {
    case 'Escape': close(); break;
    case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); step(-1); break;
    case 'ArrowRight': case 'ArrowDown': e.preventDefault(); step(1); break;
    case '+': case '=': e.preventDefault(); zoomBy(1, cx, cy); break;
    case '-': case '_': e.preventDefault(); zoomBy(-1, cx, cy); break;
  }
});
