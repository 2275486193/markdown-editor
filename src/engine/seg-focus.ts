// Per-segment marker visibility. Each contentEditable block registers
// a callback. On selectionchange, only the active block's callback runs.

type FocusFn = (el: HTMLElement) => void;
const listeners: { el: HTMLElement; fn: FocusFn }[] = [];

document.addEventListener('selectionchange', () => {
  const active = document.activeElement;
  for (const { el, fn } of listeners) {
    if (el.contains(active)) { fn(el); return; }
  }
});

export function registerSegFocus(el: HTMLElement, fn: FocusFn) {
  listeners.push({ el, fn });
}

export function unregisterSegFocus(el: HTMLElement) {
  for (let i = listeners.length - 1; i >= 0; i--) {
    if (listeners[i].el === el) listeners.splice(i, 1);
  }
}
