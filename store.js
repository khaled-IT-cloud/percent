/* ============================================================
   PERCENT PERFUME — Shared Store Module
   Newsletter + Admin session + Export/Import
   ============================================================ */
(function (global) {
  'use strict';

  const KEYS = {
    NEWSLETTER:   'percent_newsletter',
    ADMIN_SESSION:'percent_admin_session',
    ADMIN_PASS:   'percent_admin_pass',
    SETTINGS:     'percent_settings'
  };

  const DEFAULT_PASS = '532008';
  const LEGACY_DEFAULT_PASS = 'percent2024';

  /* ---------- Storage helpers ---------- */
  function readJSON(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch(e){ return fallback; }
  }
  function writeJSON(key, val){
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
  }
  function removeKey(key){
    try { localStorage.removeItem(key); } catch(e){}
  }

  /* ============================================================
     NEWSLETTER
  ============================================================ */
  function getSubscribers(){
    const arr = readJSON(KEYS.NEWSLETTER, []);
    return Array.isArray(arr) ? arr : [];
  }

  function addSubscriber(email, source){
    email = String(email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return { ok:false, reason:'invalid' };
    }
    const list = getSubscribers();
    const existing = list.find(s => s.email === email);
    if (existing){
      // update source + last date
      existing.lastSeen = new Date().toISOString();
      if (source) existing.source = source;
      writeJSON(KEYS.NEWSLETTER, list);
      return { ok:true, existed:true };
    }
    list.push({
      email,
      source: source || 'unknown',
      date: new Date().toISOString()
    });
    writeJSON(KEYS.NEWSLETTER, list);
    return { ok:true, existed:false };
  }

  function removeSubscriber(email){
    const list = getSubscribers().filter(s => s.email !== email);
    writeJSON(KEYS.NEWSLETTER, list);
  }

  function clearSubscribers(){
    writeJSON(KEYS.NEWSLETTER, []);
  }

  /* ============================================================
     ADMIN AUTH
  ============================================================ */
  function getAdminPassword(){
    const savedPassword = localStorage.getItem(KEYS.ADMIN_PASS);
    return !savedPassword || savedPassword === LEGACY_DEFAULT_PASS ? DEFAULT_PASS : savedPassword;
  }

  function setAdminPassword(newPass){
    if (!newPass || newPass.length < 4) return false;
    try { localStorage.setItem(KEYS.ADMIN_PASS, newPass); return true; }
    catch(e){ return false; }
  }

  function adminLogin(password){
    if (password === getAdminPassword()){
      writeJSON(KEYS.ADMIN_SESSION, {
        loggedAt: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  function adminLogout(){
    removeKey(KEYS.ADMIN_SESSION);
  }

  function isAdminLoggedIn(){
    const s = readJSON(KEYS.ADMIN_SESSION, null);
    if (!s) return false;
    // Session expires after 12 hours
    const diff = Date.now() - new Date(s.loggedAt).getTime();
    if (diff > 12 * 60 * 60 * 1000){
      adminLogout();
      return false;
    }
    return true;
  }

  /* ============================================================
     EXPORT / IMPORT
  ============================================================ */
  function exportAll(){
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        orders:      readJSON('percent_orders', []),
        orderChats:  readJSON('percent_order_chats', {}),
        cart:        readJSON('percent_cart', []),
        coupon:      readJSON('percent_coupon', null),
        newsletter:  getSubscribers()
      }
    };
  }

  function importAll(json){
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (!parsed || !parsed.data) return { ok:false, reason:'invalid' };

      if (Array.isArray(parsed.data.orders)){
        writeJSON('percent_orders', parsed.data.orders);
      }
      if (parsed.data.orderChats && typeof parsed.data.orderChats === 'object'){
        writeJSON('percent_order_chats', parsed.data.orderChats);
      }
      if (Array.isArray(parsed.data.newsletter)){
        writeJSON(KEYS.NEWSLETTER, parsed.data.newsletter);
      }
      if (Array.isArray(parsed.data.cart)){
        writeJSON('percent_cart', parsed.data.cart);
      }
      if (parsed.data.coupon !== undefined){
        writeJSON('percent_coupon', parsed.data.coupon);
      }
      return { ok:true };
    } catch(e){
      return { ok:false, reason:'parse' };
    }
  }

  function clearAllData(){
    removeKey('percent_orders');
    removeKey('percent_order_chats');
    removeKey('percent_cart');
    removeKey('percent_coupon');
    removeKey(KEYS.NEWSLETTER);
  }

  /* ============================================================
     PUBLIC API
  ============================================================ */
  global.PercentStore = {
    // newsletter
    getSubscribers,
    addSubscriber,
    removeSubscriber,
    clearSubscribers,
    // admin auth
    adminLogin,
    adminLogout,
    isAdminLoggedIn,
    getAdminPassword,
    setAdminPassword,
    // data
    exportAll,
    importAll,
    clearAllData
  };

})(window);