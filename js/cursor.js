/**
 * Curseur personnalisé.
 *
 * Deux éléments : un point qui colle exactement au pointeur, et un anneau qui
 * le rattrape avec un léger retard. C'est ce décalage qui donne la sensation
 * de matière — sans lui, un curseur dessiné n'apporte rien.
 *
 * Il ne s'active que sur un pointeur fin (souris, trackpad) : sur écran
 * tactile il n'y a pas de position au repos, et masquer le curseur système
 * sur une machine sans souris rendrait le site inutilisable. Le curseur natif
 * n'est masqué qu'une fois celui-ci réellement en place.
 */

const FOLLOW = 0.19;          // inertie de l'anneau — plus bas, plus traînant
const INTERACTIVE =
  'a, button, select, input, label, [role="button"], [role="option"], .dropzone, .tab';

export function initCursor() {
  const fine = matchMedia('(pointer: fine)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || calm) return;

  const ring = document.createElement('div');
  ring.className = 'cursor-ring';

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';

  document.body.append(ring, dot);
  document.documentElement.classList.add('has-custom-cursor');

  let pointerX = innerWidth / 2;
  let pointerY = innerHeight / 2;
  let ringX = pointerX;
  let ringY = pointerY;
  let visible = false;

  addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;

    if (!visible) {
      visible = true;
      // Sans ce saut initial, l'anneau traverserait l'écran à la première
      // apparition depuis le centre.
      ringX = pointerX;
      ringY = pointerY;
      ring.classList.add('is-visible');
      dot.classList.add('is-visible');
    }

    dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;

    const target = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    ring.classList.toggle('is-hover', Boolean(target));
  }, { passive: true });

  addEventListener('pointerdown', () => ring.classList.add('is-press'));
  addEventListener('pointerup', () => ring.classList.remove('is-press'));

  // Le pointeur quittant la fenêtre, on efface : un anneau figé dans un coin
  // ferait croire à un blocage.
  document.addEventListener('pointerleave', () => {
    visible = false;
    ring.classList.remove('is-visible');
    dot.classList.remove('is-visible');
  });

  const tick = () => {
    ringX += (pointerX - ringX) * FOLLOW;
    ringY += (pointerY - ringY) * FOLLOW;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/**
 * Révèle les sections à l'approche du défilement.
 * Sans IntersectionObserver — ou en mouvement réduit — tout reste visible :
 * l'animation est un bonus, jamais une condition d'affichage.
 */
export function initReveals() {
  const targets = document.querySelectorAll('[data-reveal]');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (calm || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('js-reveals');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  targets.forEach((el) => observer.observe(el));
}
