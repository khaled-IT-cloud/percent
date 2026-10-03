/* ============================================================
   PERCENT PERFUME — Shared Cart UI (v3)
   - Drawer with images
   - No shipping line
   - Global add-to-cart delegation
   ============================================================ */
(function () {
  'use strict';

  const Cart = window.PercentCart;
  if (!Cart) {
    console.warn('[cart-ui] PercentCart not found. Include cart.js before cart-ui.js.');
    return;
  }

  const $  = (s, c = document) => c.querySelector(s);
  const html = document.documentElement;

  function getLang(){
    return html.dataset.lang || html.lang || 'ar';
  }

  const TXT = {
    ar: {
      empty:     'سلتك فارغة حالياً',
      emptyHint: 'ابدأ التسوق وأضف عطورك المفضلة',
      removed:   'تم الحذف من السلة',
      added:     'تمت الإضافة إلى السلة',
      checkout:  'يرجى مراجعة الطلب من صفحة السلة',
      subtotal:  'المجموع الفرعي'
    },
    en: {
      empty:     'Your bag is empty',
      emptyHint: 'Start shopping and add your favorite scents',
      removed:   'Removed from cart',
      added:     'Added to cart',
      checkout:  'Please review your order from the cart page',
      subtotal:  'Subtotal'
    }
  };
  const T = k => (TXT[getLang()] && TXT[getLang()][k]) || TXT.ar[k] || k;

  const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a1128"/>
          <stop offset="100%" stop-color="#1d2c58"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#g)"/>
      <text x="60" y="72" text-anchor="middle"
            font-family="Georgia, serif" font-size="42" font-weight="bold"
            fill="#d4af37" letter-spacing="2">P</text>
    </svg>
  `)}`;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function showToast(msg, icon, type){
    const toast = $('#toast');
    if (!toast) return;
    const textEl = $('#toastText');
    if (textEl) textEl.textContent = msg;
    const i = toast.querySelector('i');
    if (i) i.className = 'fas ' + (icon || 'fa-check-circle');
    toast.classList.remove('error', 'success');
    if (type) toast.classList.add(type);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  /* ---------- Drawer ---------- */
  const cartDrawer = $('#cartDrawer');
  const overlay    = $('#overlay');
  const cartBody   = $('#cartBody');
  const cartTotal  = $('#cartTotal');

  function openCart(){
    if (!cartDrawer) return;
    cartDrawer.classList.add('open');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeCart(){
    if (!cartDrawer) return;
    cartDrawer.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  const cartBtn = $('#cartBtn');
  if (cartBtn) cartBtn.addEventListener('click', openCart);
  const cartClose = $('#cartClose');
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (overlay) overlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

  /* ---------- "View full cart" link ---------- */
  (function addViewFullLink(){
    if (!cartDrawer) return;
    const foot = cartDrawer.querySelector('.cart-foot');
    if (!foot || foot.querySelector('.view-full-cart')) return;

    const link = document.createElement('a');
    link.href = 'cart.html';
    link.className = 'view-full-cart';
    link.innerHTML =
      '<i class="fas fa-arrow-left"></i>' +
      '<span class="lang-ar">متابعة الطلب</span>' +
      '<span class="lang-en">Continue to Checkout</span>';
    foot.appendChild(link);

    if (!document.getElementById('viewFullCartStyle')){
      const style = document.createElement('style');
      style.id = 'viewFullCartStyle';
      style.textContent = `
        .view-full-cart{
          display:flex;align-items:center;justify-content:center;gap:9px;
          margin-top:10px;padding:12px 16px;border-radius:10px;
          background:transparent;
          border:1px dashed rgba(212,175,55,.5);
          color:var(--gold-deep, #b8860b);
          font-weight:800;font-size:.85rem;
          transition:all .35s cubic-bezier(.22,1,.36,1);
          text-decoration:none;
        }
        .view-full-cart:hover{
          background:rgba(212,175,55,.1);
          border-style:solid;
          transform:translateY(-2px);
          box-shadow:0 10px 24px rgba(212,175,55,.15);
        }
        .view-full-cart i{color:var(--gold, #d4af37);font-size:.8rem}
        html[dir="ltr"] .view-full-cart i{transform:rotate(180deg)}
      `;
      document.head.appendChild(style);
    }
  })();

  /* ---------- Render drawer ---------- */
  function renderDrawer(state){
    state = state || Cart.get();
    if (!cartDrawer || !cartBody || !cartTotal) return;

    const lang = getLang();

    if (!state.items.length){
      cartBody.innerHTML = `
        <div class="cart-empty">
          <i class="fas fa-bag-shopping"></i>
          <p>${T('empty')}</p>
          <p style="font-size:.82rem;opacity:.75;margin-top:6px">${T('emptyHint')}</p>
        </div>`;
    } else {
      cartBody.innerHTML = state.items.map(item => {
        const img = item.image || FALLBACK_SVG;
        const fallback = FALLBACK_SVG;
        return `
          <div class="cart-item" data-id="${item.id}">
            <div class="cart-item-thumb">
              <img src="${img}" alt="" loading="lazy"
                   onerror="this.onerror=null;this.src='${fallback}'">
            </div>
            <div class="cart-item-info">
              <strong>${lang === 'ar' ? item.nameAr : item.nameEn}</strong>
              <span>${(item.price * item.qty).toFixed(2)} JOD</span>
              <div class="qty-ctrl">
                <button data-act="dec" data-id="${item.id}" ${item.qty <= 1 ? 'disabled' : ''}>−</button>
                <span>${item.qty}</span>
                <button data-act="inc" data-id="${item.id}">+</button>
              </div>
            </div>
            <button class="cart-remove" data-act="del" data-id="${item.id}" aria-label="Remove">
              <i class="fas fa-trash-can"></i>
            </button>
          </div>
        `;
      }).join('');
    }

    cartTotal.textContent = state.total.toFixed(2) + ' JOD';
  }

  /* ---------- Drawer clicks ---------- */
  if (cartBody){
    cartBody.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id  = btn.dataset.id;
      const act = btn.dataset.act;
      const item = Cart.getItems().find(x => x.id === id);
      if (!item) return;

      if (act === 'inc') Cart.setQty(id, item.qty + 1);
      else if (act === 'dec') { if (item.qty > 1) Cart.setQty(id, item.qty - 1); }
      else if (act === 'del') { Cart.remove(id); showToast(T('removed'), 'fa-trash-can'); }
    });
  }

  /* ---------- Global add-to-cart ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const card = btn.closest('.product-card');
    if (!card) return;

    const nameEn = card.dataset.nameEn || '';
    const slug = nameEn.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const id = card.dataset.name || card.dataset.id || slug || ('product-' + Date.now());

    const item = {
      id,
      nameAr:   card.dataset.nameAr || nameEn || id,
      nameEn:   nameEn || id,
      price:    parseFloat(card.dataset.price) || 0,
      category: card.dataset.category || '',
      image:    card.dataset.image || ''
    };

    Cart.add(item);
    showToast(T('added'), 'fa-check-circle', 'success');

    const badge = document.querySelector('.cart-count');
    if (badge){
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }

    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background  = 'var(--gold, #d4af37)';
    btn.style.color       = 'var(--navy, #0a1128)';
    btn.style.borderColor = 'var(--gold, #d4af37)';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background  = '';
      btn.style.color       = '';
      btn.style.borderColor = '';
    }, 1100);
  }, true);

  /* ---------- Checkout button (in drawer) → go to cart.html ---------- */
  const checkoutBtn = $('#checkoutBtn');
  if (checkoutBtn){
    checkoutBtn.addEventListener('click', () => {
      if (!Cart.getItems().length) {
        showToast(getLang() === 'ar' ? 'سلتك فارغة' : 'Your cart is empty', 'fa-bag-shopping', 'error');
        return;
      }
      window.location.href = 'cart.html';
    });
  }

  /* ---------- React to changes ---------- */
  Cart.onChange(renderDrawer);

  const langBtn = $('#langBtn');
  if (langBtn){
    langBtn.addEventListener('click', () => setTimeout(() => renderDrawer(), 60));
  }

  renderDrawer();

})();