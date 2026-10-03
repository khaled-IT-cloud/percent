/* ============================================================
   PERCENT PERFUME — Cart Module (Supabase Orders + Chats)
   ============================================================ */
(function (global) {
  'use strict';

  const CART_KEY    = 'percent_cart';
  const COUPON_KEY  = 'percent_coupon';

  const SUPABASE_URL = 'https://iedmrzocqgscnybpvxed.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Q_vZjEcX-bN6Dkyee3jN5g_TWlovcPQ';

  const COUPONS = {
    'PERCENT10': { type: 'percent', value: 10, labelAr: 'خصم 10%',  labelEn: '10% off' },
    'PERCENT20': { type: 'percent', value: 20, labelAr: 'خصم 20%',  labelEn: '20% off' },
    'OUD25':     { type: 'percent', value: 25, labelAr: 'خصم 25%',  labelEn: '25% off' },
    'WELCOME15': { type: 'percent', value: 15, labelAr: 'خصم 15%',  labelEn: '15% off' }
  };

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

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

  let cart   = readJSON(CART_KEY, []);
  if (!Array.isArray(cart)) cart = [];
  let coupon = readJSON(COUPON_KEY, null);

  const listeners = new Set();

  function getSubtotal() { return cart.reduce((s, it) => s + it.price * it.qty, 0); }
  function getCount() { return cart.reduce((s, it) => s + it.qty, 0); }
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

  function persist() { writeJSON(CART_KEY, cart); }
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
        id: String(item.id),
        nameAr: item.nameAr || item.id,
        nameEn: item.nameEn || item.id,
        price: Number(item.price) || 0,
        qty: Math.max(1, Number(item.qty) || 1),
        category: item.category || '',
        image: item.image || ''
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

  /* ============ Orders (Supabase) ============ */
  let cachedOrders = [];
  let orderListeners = new Set();

  function generateOrderNumber() {
    const date = new Date();
    const dateCode = String(date.getFullYear()).slice(-2)
                   + String(date.getMonth() + 1).padStart(2, '0')
                   + String(date.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return 'PERC-' + dateCode + '-' + randomSuffix;
  }

  async function fetchOrders() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`,
        { headers }
      );
      if (!res.ok) {
        console.error('Fetch orders error:', res.status);
        return cachedOrders;
      }
      const data = await res.json();
      cachedOrders = (data || []).map(o => ({
        orderNumber: o.order_number,
        createdAt: o.created_at,
        customer: o.customer || {},
        payment: o.payment || {},
        items: o.items || [],
        subtotal: Number(o.subtotal) || 0,
        discount: Number(o.discount) || 0,
        coupon: o.coupon,
        total: Number(o.total) || 0,
        status: o.status || 'pending',
        memberPhone: o.member_phone,
        memberName: o.member_name,
        lang: o.lang
      }));
      orderListeners.forEach(fn => { try { fn(cachedOrders); } catch(e){} });
      return cachedOrders;
    } catch (e) {
      console.error('Fetch error:', e);
      return cachedOrders;
    }
  }

  async function saveOrder(orderData) {
    const order = {
      order_number: generateOrderNumber(),
      created_at: new Date().toISOString(),
      customer: orderData.customer || {},
      payment: orderData.payment || {},
      items: orderData.items || [],
      subtotal: Number(orderData.subtotal) || 0,
      discount: Number(orderData.discount) || 0,
      coupon: orderData.coupon || null,
      total: Number(orderData.total) || 0,
      status: 'pending',
      member_phone: orderData.memberPhone || null,
      member_name: orderData.memberName || null,
      lang: orderData.lang || 'ar'
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(order)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Save order error:', err);
      throw new Error('Failed to save order');
    }

    await fetchOrders();
    return {
      orderNumber: order.order_number,
      createdAt: order.created_at,
      customer: order.customer,
      payment: order.payment,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      coupon: order.coupon,
      total: order.total,
      status: order.status,
      memberPhone: order.member_phone,
      memberName: order.member_name,
      lang: order.lang
    };
  }

  function getOrders() { return cachedOrders; }

  async function updateOrderStatus(orderNumber, status) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
      { method: 'PATCH', headers, body: JSON.stringify({ status }) }
    );
    if (res.ok) { await fetchOrders(); return { ok: true }; }
    return { ok: false };
  }

  async function deleteOrder(orderNumber) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
      { method: 'DELETE', headers }
    );
    if (res.ok) { await fetchOrders(); return { ok: true }; }
    return { ok: false };
  }

  function onOrdersChange(fn) {
    orderListeners.add(fn);
    fn(cachedOrders);
    return () => orderListeners.delete(fn);
  }

  /* ============ Order Chats (Supabase) ============ */
  let cachedChats = {};  // { orderNumber: { messages: [...] } }
  const chatListeners = new Set();

  async function fetchChats() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/order_chats?select=*&order=created_at.asc`,
        { headers }
      );
      if (!res.ok) {
        console.error('Fetch chats error:', res.status);
        return cachedChats;
      }
      const data = await res.json();
      const newChats = {};
      (data || []).forEach(row => {
        const key = String(row.order_number);
        if (!newChats[key]) newChats[key] = { messages: [] };
        newChats[key].messages.push({
          sender: row.sender,
          text: row.text,
          createdAt: row.created_at
        });
      });
      cachedChats = newChats;
      chatListeners.forEach(fn => { try { fn(); } catch(e){} });
      return cachedChats;
    } catch (e) {
      console.error('Fetch chats error:', e);
      return cachedChats;
    }
  }

  function getOrderChat(orderNumber) {
    return cachedChats[String(orderNumber || '')] || { messages: [] };
  }

  function sendOrderMessage(orderNumber, text, sender) {
    orderNumber = String(orderNumber || '').trim();
    text = String(text || '').trim();
    if (!orderNumber || !text || !['customer', 'admin'].includes(sender)) return false;

    // 🔥 إرسال إلى Supabase
    fetch(`${SUPABASE_URL}/rest/v1/order_chats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order_number: orderNumber,
        sender: sender,
        text: text.slice(0, 2000)
      })
    })
    .then(() => fetchChats())
    .catch(e => console.error('Send message error:', e));

    return true;
  }

  function onChatChange(fn) {
    chatListeners.add(fn);
    return () => chatListeners.delete(fn);
  }

  /* ============ Badges ============ */
  function updateBadges() {
    const qty = getCount();
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = qty;
      el.classList.toggle('show', qty > 0);
    });
  }

  /* ============ Pub/Sub ============ */
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

  /* ============ Cross-tab sync ============ */
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
  });

  /* ============ Realtime (orders + chats) ============ */
  function initRealtime() {
    try {
      if (typeof supabase !== 'undefined') {
        const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        client.channel('db-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
            () => { fetchOrders(); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'order_chats' },
            () => { fetchChats(); })
          .subscribe();
      } else {
        setInterval(fetchOrders, 30000);
        setInterval(fetchChats, 30000);
      }
    } catch(e) {
      setInterval(fetchOrders, 30000);
      setInterval(fetchChats, 30000);
    }
  }

  /* ============ Init ============ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadges);
  } else {
    updateBadges();
  }

  fetchOrders().then(() => initRealtime());
  fetchChats();

  /* ============ Public API ============ */
  global.PercentCart = {
    get: getState,
    getItems: () => cart.slice(),
    getSubtotal,
    getCount,
    add, remove, setQty, clear,
    applyCoupon, removeCoupon,
    saveOrder, getOrders, updateOrderStatus, deleteOrder,
    onOrdersChange, fetchOrders,
    getOrderChat, sendOrderMessage, onChatChange, fetchChats,
    onChange,
    COUPONS
  };

})(window);
