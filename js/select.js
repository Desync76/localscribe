/**
 * Menus déroulants sur mesure.
 *
 * Le popup d'un `<select>` natif est dessiné par le système : ni ses couleurs,
 * ni sa largeur, ni sa police ne sont accessibles à la CSS. En thème sombre il
 * s'ouvre donc en blanc, et les libellés longs y sont tronqués.
 *
 * Le `<select>` d'origine reste dans le DOM — masqué mais vivant — et garde le
 * rôle de source de vérité : c'est lui qu'on lit et qui émet `change`. Le reste
 * de l'application ignore complètement l'existence de ce composant.
 */

export function enhanceSelects(root = document) {
  root.querySelectorAll('select:not([data-enhanced])').forEach(build);
}

function build(select) {
  select.dataset.enhanced = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'xsel';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'xsel-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const value = document.createElement('span');
  value.className = 'xsel-value';

  const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  caret.setAttribute('class', 'xsel-caret');
  caret.setAttribute('viewBox', '0 0 24 24');
  caret.setAttribute('aria-hidden', 'true');
  caret.innerHTML = '<path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" ' +
                    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';

  trigger.append(value, caret);

  const menu = document.createElement('div');
  menu.className = 'xsel-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  select.parentNode.insertBefore(wrap, select);
  wrap.append(select, trigger, menu);

  let open = false;
  let active = -1;

  /** Reconstruit la liste à partir des <option> courantes. */
  const sync = () => {
    const options = [...select.options];
    value.textContent = select.selectedOptions[0]?.textContent ?? '';

    menu.replaceChildren(...options.map((option, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'xsel-opt';
      item.dataset.index = String(index);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === select.selectedIndex));
      item.disabled = option.disabled;
      item.textContent = option.textContent;
      // Décale légèrement chaque entrée : l'ouverture se déroule en cascade.
      item.style.setProperty('--i', String(index));
      return item;
    }));
  };

  const highlight = (index) => {
    active = index;
    menu.querySelectorAll('.xsel-opt').forEach((item, i) => {
      item.classList.toggle('is-active', i === index);
    });
    menu.children[index]?.scrollIntoView({ block: 'nearest' });
  };

  const openMenu = () => {
    if (open) return;
    open = true;
    menu.hidden = false;
    // Le retrait du `hidden` et l'ajout de la classe doivent tomber sur deux
    // frames distinctes, sinon la transition d'entrée ne se joue pas.
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    trigger.setAttribute('aria-expanded', 'true');
    highlight(select.selectedIndex);
  };

  const closeMenu = () => {
    if (!open) return;
    open = false;
    wrap.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    const done = () => { if (!open) menu.hidden = true; };
    menu.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 260); // filet de sécurité si la transition ne se joue pas
  };

  const choose = (index) => {
    const option = select.options[index];
    if (!option || option.disabled) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
    closeMenu();
    trigger.focus();
  };

  trigger.addEventListener('click', () => (open ? closeMenu() : openMenu()));

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('.xsel-opt');
    if (item) choose(Number(item.dataset.index));
  });

  menu.addEventListener('mousemove', (event) => {
    const item = event.target.closest('.xsel-opt');
    if (item) highlight(Number(item.dataset.index));
  });

  wrap.addEventListener('keydown', (event) => {
    const last = select.options.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        open ? highlight(Math.min(active + 1, last)) : openMenu();
        break;
      case 'ArrowUp':
        event.preventDefault();
        open ? highlight(Math.max(active - 1, 0)) : openMenu();
        break;
      case 'Home':
        if (open) { event.preventDefault(); highlight(0); }
        break;
      case 'End':
        if (open) { event.preventDefault(); highlight(last); }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        open ? choose(active) : openMenu();
        break;
      case 'Escape':
        if (open) { event.preventDefault(); closeMenu(); trigger.focus(); }
        break;
      case 'Tab':
        closeMenu();
        break;
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!wrap.contains(event.target)) closeMenu();
  });

  // L'application remplace parfois les <option> (la liste des modèles change
  // avec l'accélération) : on se resynchronise sans qu'elle ait à le signaler.
  new MutationObserver(sync).observe(select, { childList: true });
  select.addEventListener('change', sync);

  sync();
}
