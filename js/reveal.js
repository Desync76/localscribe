/**
 * Révélations au défilement.
 *
 * Les sections apparaissent à l'approche du regard. Sans
 * IntersectionObserver — ou si le système demande un mouvement réduit — rien
 * n'est masqué du tout : l'animation est un agrément, jamais une condition
 * d'affichage. C'est pour ça que l'état masqué est posé par ce script (via la
 * classe `js-reveals`) plutôt que codé en dur dans la feuille de style.
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
