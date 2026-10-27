/**
 * The highlight on the word being recited, made of two layers that exist only for the word being said
 * (and for the one fading out behind it): a soft blurred glow, and an accent copy of the word that is
 * uncovered from right to left. Moving the copy is a pair of transforms, so each frame only composites
 * and never repaints the text. Both layers fade, which keeps the hand-over between words smooth.
 */
type Lit = { glow: HTMLElement; fx?: HTMLElement; inner?: HTMLElement };

const lit = new WeakMap<HTMLElement, Lit>();
const timers = new WeakMap<HTMLElement, number>();
let current: Lit | null = null;

function layer(cls: string, text: string): HTMLElement {
  const el = document.createElement('span');
  el.className = cls;
  el.setAttribute('aria-hidden', 'true');
  el.textContent = text;
  return el;
}

/** Make `w` the word being recited. */
export function light(w: HTMLElement) {
  clearTimeout(timers.get(w));
  let l = lit.get(w);
  if (!l) {
    const t = w.querySelector<HTMLElement>('.t');
    const text = t?.dataset.t;
    if (!t || !text) {
      w.classList.add('active');
      current = null;
      return;
    }
    // the rule colours of a tajweed word are kept in the swept part too: its copy is made from the same markup
    const markup = w.classList.contains('tj') ? t.innerHTML : '';
    l = { glow: layer('gl', text) };
    t.prepend(l.glow);
    const fx = layer('fx', '');
    const inner = layer('', markup ? '' : text);
    if (markup) inner.innerHTML = markup;
    fx.append(inner);
    t.prepend(fx);
    l.fx = fx;
    l.inner = inner;
    lit.set(w, l);
    void getComputedStyle(l.glow).opacity; // commit the faded-out state so the fade-in has somewhere to start
  }
  current = l;
  progress(0);
  w.classList.add('active');
}

/** The word being recited was redrawn (another script style): rebuild its layers from the new text. */
export function relight(w: HTMLElement) {
  const l = lit.get(w);
  if (l) {
    clearTimeout(timers.get(w));
    l.glow.remove();
    l.fx?.remove();
    lit.delete(w);
    if (current === l) current = null;
  }
  light(w);
}

/** How much of the current word has been said, 0 to 1. */
export function progress(p: number) {
  if (!current?.fx || !current.inner) return;
  const off = ((1 - p) * 100).toFixed(2);
  current.fx.style.transform = `translateX(${off}%)`;
  current.inner.style.transform = `translateX(-${off}%)`;
}

/** The word is no longer being recited: let it fade, then drop its layers. */
export function dim(w: HTMLElement | null) {
  if (!w) return;
  w.classList.remove('active');
  const l = lit.get(w);
  if (!l) return;
  if (current === l) current = null;
  timers.set(
    w,
    window.setTimeout(() => {
      l.glow.remove();
      l.fx?.remove();
      lit.delete(w);
    }, 800)
  );
}
