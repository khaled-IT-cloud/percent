/* ============================================================
   PERCENT PERFUME — Unified Cart Module (v2)
   - No shipping fees
   - Coupons
   - Orders saved to localStorage
   ============================================================ */
(function (global) {
  'use strict';

  const CART_KEY    = 'percent_cart';
  const COUPON_KEY  = 'percent_coupon';
  const ORDERS_KEY  = 'percent_orders';
  const CHATS_KEY   = 'percent_order_chats';

  const COUPONS = {
    'PERCENT10': { type: 'percent', value: 10, labelAr: 'خصم 10%',  labelEn: '10% off' },
    'PERCENT20': { type: 'percent', value: 20, labelAr: 'خصم 20%',  labelEn: '20% off' },
    'OUD25':     { type: 'percent', value: 25, labelAr: 'خصم 25%',  labelEn: '25% off' },
    'WELCOME15': { type: 'percent', value: 15, labelAr: 'خصم 15%',  labelEn: '15% off' }
  };

  /* ---------- Storage ---------- */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* ---------- State ---------- */
  let cart   = readJSON(CART_KEY, []);
  if (!Array.isArray(cart)) cart = [];
  let coupon = readJSON(COUPON_KEY, null);

  const listeners = new Set();

  /* ---------- Calculations ---------- */
  function getSubtotal() {
    return cart.reduce((s, it) => s + it.price * it.qty, 0);
  }
  function getCount() {
    return cart.reduce((s, it) => s + it.qty, 0);
  }
  function computeDiscount(subtotal) {
    if (!coupon || coupon.type !== 'percent') return 0;
    return subtotal * (coupon.value / 100);
  }

  function getState() {
    const subtotal = getSubtotal();
    const itemCount = getCount();
    const discount = computeDiscount(subtotal);
    const total = Math.max(0, subtotal - discount);
    return {
      items: cart.slice(),
      subtotal, itemCount, discount, total,
      coupon: coupon ? { ...coupon } : null
    };
  }

  /* ---------- Mutations ---------- */
  function persist()       { writeJSON(CART_KEY, cart); }
  function persistCoupon() { writeJSON(COUPON_KEY, coupon); }

  function add(item) {
    if (!item || !item.id) return;
    const existing = cart.find(it => it.id === item.id);
    if (existing) {
      existing.qty += (Number(item.qty) || 1);
      if (item.image) existing.image = item.image;
      if (item.nameAr) existing.nameAr = item.nameAr;
      if (item.nameEn) existing.nameEn = item.nameEn;
    } else {
      cart.push({
        id:        String(item.id),
        nameAr:    item.nameAr || item.id,
        nameEn:    item.nameEn || item.id,
        price:     Number(item.price) || 0,
        qty:       Math.max(1, Number(item.qty) || 1),
        category:  item.category || '',
        image:     item.image || ''
      });
    }
    persist(); emit();
  }

  function remove(id) {
    const idx = cart.findIndex(it => it.id === id);
    if (idx === -1) return;
    cart.splice(idx, 1);
    persist(); emit();
  }

  function setQty(id, qty) {
    const it = cart.find(x => x.id === id);
    if (!it) return;
    qty = Number(qty);
    if (!qty || qty <= 0) return remove(id);
    it.qty = qty;
    persist(); emit();
  }

  function clear() {
    cart = [];
    coupon = null;
    persist(); persistCoupon(); emit();
  }

  function applyCoupon(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return { ok: false, reason: 'empty' };
    const c = COUPONS[normalized];
    if (!c) return { ok: false, reason: 'invalid' };
    coupon = { code: normalized, ...c };
    persistCoupon(); emit();
    return { ok: true, coupon: { ...coupon } };
  }

  function removeCoupon() {
    coupon = null;
    persistCoupon(); emit();
  }

  /* ---------- Orders ---------- */
  function generateOrderNumber(existingOrders) {
    const date = new Date();
    const dateCode = String(date.getFullYear()).slice(-2)
                   + String(date.getMonth() + 1).padStart(2, '0')
                   + String(date.getDate()).padStart(2, '0');
    let orderNumber;
    do {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      orderNumber = 'PERC-' + dateCode + '-' + randomSuffix;
    } while (existingOrders.some(order => order.orderNumber === orderNumber));
    return orderNumber;
  }

  function saveOrder(orderData) {
    let orders = readJSON(ORDERS_KEY, []);
    if (!Array.isArray(orders)) orders = [];
    const order = {
      orderNumber: generateOrderNumber(orders),
      createdAt: new Date().toISOString(),
      ...orderData
    };
    orders.push(order);
    writeJSON(ORDERS_KEY, orders);
    return order;
  }

  function getOrders() {
    return readJSON(ORDERS_KEY, []);
  }

  /* ---------- Order support chats ---------- */
  function getOrderChat(orderNumber) {
    const chats = readJSON(CHATS_KEY, {});
    const chat = chats && chats[String(orderNumber || '')];
    return chat && Array.isArray(chat.messages) ? chat : { messages: [] };
  }

  function sendOrderMessage(orderNumber, text, sender) {
    orderNumber = String(orderNumber || '').trim();
    text = String(text || '').trim();
    if (!orderNumber || !text || !['customer', 'admin'].includes(sender)) return false;

    const chats = readJSON(CHATS_KEY, {});
    if (!chats[orderNumber]) chats[orderNumber] = { messages: [] };
    if (!Array.isArray(chats[orderNumber].messages)) chats[orderNumber].messages = [];
    chats[orderNumber].messages.push({
      sender,
      text: text.slice(0, 2000),
      createdAt: new Date().toISOString()
    });
    writeJSON(CHATS_KEY, chats);
    chatListeners.forEach(fn => { try { fn(orderNumber); } catch (e) {} });
    return true;
  }

  const chatListeners = new Set();
  function onChatChange(fn) {
    chatListeners.add(fn);
    return () => chatListeners.delete(fn);
  }

  /* ---------- Badges ---------- */
  function updateBadges() {
    const qty = getCount();
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = qty;
      el.classList.toggle('show', qty > 0);
    });
  }

  /* ---------- Pub/Sub ---------- */
  function emit() {
    updateBadges();
    const state = getState();
    listeners.forEach(fn => { try { fn(state); } catch (e) {} });
  }

  function onChange(fn) {
    listeners.add(fn);
    fn(getState());
    return () => listeners.delete(fn);
  }

  /* ---------- Cross-tab sync ---------- */
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) {
      cart = readJSON(CART_KEY, []);
      if (!Array.isArray(cart)) cart = [];
      emit();
    }
    if (e.key === COUPON_KEY) {
      coupon = readJSON(COUPON_KEY, null);
      emit();
    }
    if (e.key === CHATS_KEY) {
      chatListeners.forEach(fn => { try { fn(); } catch (err) {} });
    }
  });

  /* ---------- Init ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadges);
  } else {
    updateBadges();
  }

  /* ---------- Public API ---------- */
  global.PercentCart = {
    get: getState,
    getItems: () => cart.slice(),
    getSubtotal,
    getCount,
    add, remove, setQty, clear,
    applyCoupon, removeCoupon,
    saveOrder, getOrders,
    getOrderChat, sendOrderMessage, onChatChange,
    onChange,
    COUPONS
  };

})(window);