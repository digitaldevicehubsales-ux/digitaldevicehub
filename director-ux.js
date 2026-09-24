(() => {
  'use strict';

  const title = document.querySelector('#directorPageTitle');
  const gate = document.querySelector('#directorGate');
  const nav = document.querySelector('.director-nav');

  function syncViewState(view, focusTitle=false){
    if(!view) return;
    document.querySelectorAll('.director-nav [data-view]').forEach(button => {
      if(button.dataset.view === view) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-panel]').forEach(panel => {
      panel.setAttribute('aria-hidden', panel.dataset.panel === view ? 'false' : 'true');
    });
    if(focusTitle && title){
      requestAnimationFrame(() => title.focus({preventScroll:true}));
    }
  }

  function requestedView(element){
    return element?.dataset?.view || element?.dataset?.go || '';
  }

  document.addEventListener('click', event => {
    const control = event.target.closest?.('[data-view],[data-go]');
    const view = requestedView(control);
    if(!view) return;
    setTimeout(() => syncViewState(view, true), 0);
  });

  if(title && !title.hasAttribute('tabindex')) title.setAttribute('tabindex','-1');
  syncViewState(document.querySelector('.director-nav [data-view].active')?.dataset.view || 'overview');

  if(gate){
    const gateTitle = gate.querySelector('h1');
    if(gateTitle && !gateTitle.hasAttribute('tabindex')) gateTitle.setAttribute('tabindex','-1');
    const focusGate = () => {
      if(!gate.hidden && gateTitle) requestAnimationFrame(() => gateTitle.focus({preventScroll:true}));
    };
    new MutationObserver(focusGate).observe(gate,{attributes:true,attributeFilter:['hidden']});
    focusGate();
  }

  if(nav){
    nav.addEventListener('keydown', event => {
      const buttons = [...nav.querySelectorAll('[data-view]')];
      const index = buttons.indexOf(document.activeElement);
      if(index < 0 || !['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if(event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      if(event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      if(event.key === 'Home') next = 0;
      if(event.key === 'End') next = buttons.length - 1;
      buttons[next]?.focus();
    });
  }
})();
