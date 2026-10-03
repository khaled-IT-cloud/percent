/* ============================================================
   PERCENT PERFUME — Loyalty Program Module (v1)
   - Phone-based login (no password)
   - Points controlled manually from Admin
   - Tier configuration editable from Admin
   - All data in localStorage
   ============================================================ */
(function (global) {
  'use strict';

  const KEYS = {
    MEMBERS:      'percent_loyalty_members',
    SESSION:      'percent_loyalty_session',
    CONFIG:       'percent_loyalty_config',
    TRANSACTIONS: 'percent_loyalty_transactions'
  };

  /* ---------- Default Configuration ---------- */
  const DEFAULT_CONFIG = {
    enabled: true,
    welcomeBonus: 0,          // نقاط ترحيبية عند التسجيل (يديرها الأدمن)
    tiers: [
      {
        id: 'bronze',
        nameAr: 'برونزي',
        nameEn: 'BRONZE',
        minPoints: 0,
        color: '#a0722e',
        bg: 'linear-gradient(135deg,#d4a574,#8b5a2b)',
        icon: 'fa-medal',
        benefitsAr: [
          'كسب النقاط من المشتريات',
          'نشرة العروض الحصرية',
          'تأكيد طلب أسرع'
        ],
        benefitsEn: [
          'Earn points on purchases',
          'Exclusive offers newsletter',
          'Faster order confirmation'
        ]
      },
      {
        id: 'silver',
        nameAr: 'فضي',
        nameEn: 'SILVER',
        minPoints: 1000,
        color: '#7a8a9a',
        bg: 'linear-gradient(135deg,#e0e6ed,#8a97a4)',
        icon: 'fa-award',
        benefitsAr: [
          'كل مزايا البرونزي',
          'أولوية في الدعم',
          'هدية عيد ميلاد (5%)'
        ],
        benefitsEn: [
          'All Bronze benefits',
          'Priority support',
          'Birthday gift (5%)'
        ]
      },
      {
        id: 'gold',
        nameAr: 'ذهبي',
        nameEn: 'GOLD',
        minPoints: 3000,
        color: '#b8860b',
        bg: 'linear-gradient(135deg,#f4e4bc,#c9a227)',
        icon: 'fa-crown',
        benefitsAr: [
          'كل مزايا الفضي',
          'استشارة عطرية مجانية',
          'هدية عيد ميلاد (10%)',
          'توصيل مجاني'
        ],
        benefitsEn: [
          'All Silver benefits',
          'Free fragrance consultation',
          'Birthday gift (10%)',
          'Free delivery'
        ]
      },
      {
        id: 'percent',
        nameAr: 'بيرسنت',
        nameEn: 'PERCENT',
        minPoints: 7000,
        color: '#0a2f2c',
        bg: 'linear-gradient(135deg,#144a45,#0a2f2c)',
        icon: 'fa-gem',
        benefitsAr: [
          'كل مزايا الذهبي',
          'عطر حصري كل 6 أشهر',
          'مدير حساب شخصي',
          'دعوات لمناسبات خاصة'
        ],
        benefitsEn: [
          'All Gold benefits',
          'Exclusive perfume every 6 months',
          'Personal account manager',
          'Special events invitations'
        ]
      }
    ],
    rewards: [
      {
        id: 'discount-5',
        pointsCost: 500,
        type: 'discount',
        value: 5,
        icon: 'fa-percent',
        nameAr: 'خصم 5 دنانير',
        nameEn: '5 JOD Discount',
        descAr: 'يُطبّق عند إتمام الطلب القادم',
        descEn: 'Applied on your next order'
      },
      {
        id: 'free-ship',
        pointsCost: 300,
        type: 'shipping',
        value: 0,
        icon: 'fa-truck-fast',
        nameAr: 'توصيل مجاني',
        nameEn: 'Free Delivery',
        descAr: 'توصيل مجاني على الطلب القادم',
        descEn: 'Free delivery on next order'
      },
      {
        id: 'discount-10',
        pointsCost: 900,
        type: 'discount',
        value: 10,
        icon: 'fa-gift',
        nameAr: 'خصم 10 دنانير',
        nameEn: '10 JOD Discount',
        descAr: 'يُطبّق عند إتمام الطلب القادم',
        descEn: 'Applied on your next order'
      },
      {
        id: 'mini-perfume',
        pointsCost: 1500,
        type: 'gift',
        value: 0,
        icon: 'fa-spray-can-sparkles',
        nameAr: 'عطر مصغّر مجاني',
        nameEn: 'Free Mini Perfume',
        descAr: 'عطر مصغّر يُرسل مع طلبك القادم',
        descEn: 'A mini perfume sent with your next order'
      },
      {
        id: 'luxury-box',
        pointsCost: 2500,
        type: 'gift',
        value: 0,
        icon: 'fa-box-open',
        nameAr: 'صندوق هدايا فاخر',
        nameEn: 'Luxury Gift Box',
        descAr: 'صندوق فاخر مع تغليف ذهبي',
        descEn: 'Luxury box with gold packaging'
      },
      {
        id: 'discount-25',
        pointsCost: 3000,
        type: 'discount',
        value: 25,
        icon: 'fa-crown',
        nameAr: 'خصم 25 دينار',
        nameEn: '25 JOD Discount',
        descAr: 'أكبر خصم متاح في البرنامج',
        descEn: 'The biggest discount available'
      }
    ]
  };

  /* ---------- Storage Helpers ---------- */
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

  /* ---------- Config ---------- */
  function getConfig(){
    const cfg = readJSON(KEYS.CONFIG, null);
    if (!cfg || !cfg.tiers || !cfg.rewards){
      writeJSON(KEYS.CONFIG, DEFAULT_CONFIG);
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
    return cfg;
  }

  function setConfig(cfg){
    if (!cfg || !Array.isArray(cfg.tiers)) return false;
    // sort tiers by minPoints asc
    cfg.tiers.sort((a,b) => a.minPoints - b.minPoints);
    writeJSON(KEYS.CONFIG, cfg);
    emit();
    return true;
  }

  function resetConfig(){
    writeJSON(KEYS.CONFIG, DEFAULT_CONFIG);
    emit();
  }

  /* ---------- Members ---------- */
  function getMembers(){
    const arr = readJSON(KEYS.MEMBERS, []);
    return Array.isArray(arr) ? arr : [];
  }

  function normalizePhone(phone){
    let p = String(phone || '').replace(/[\s\-\(\)]/g, '');
    // remove leading +962 or 00962
    p = p.replace(/^\+?962/, '0');
    p = p.replace(/^00962/, '0');
    // if starts with 7 and length 9 → add 0
    if (/^7\d{8}$/.test(p)) p = '0' + p;
    return p;
  }

  function isValidPhone(phone){
    const p = normalizePhone(phone);
    return /^07\d{8}$/.test(p);
  }

  function getMember(phone){
    const p = normalizePhone(phone);
    if (!p) return null;
    return getMembers().find(m => m.phone === p) || null;
  }

  function createMember(phone, data){
    const p = normalizePhone(phone);
    if (!isValidPhone(p)) return { ok:false, reason:'invalid_phone' };

    const existing = getMember(p);
    if (existing) return { ok:false, reason:'exists', member: existing };

    const cfg = getConfig();
    const welcome = Number(cfg.welcomeBonus) || 0;

    const member = {
      phone: p,
      name: String(data.name || '').trim() || 'عضو جديد',
      email: String(data.email || '').trim(),
      birthday: data.birthday || '',
      notes: '',
      points: welcome,
      lifetimePoints: welcome,  // لا ينقص
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      tier: getTierId(welcome).id,
      blocked: false
    };

    const members = getMembers();
    members.push(member);
    writeJSON(KEYS.MEMBERS, members);

    // Log welcome transaction if any
    if (welcome > 0){
      addTransaction(p, {
        type: 'earn',
        amount: welcome,
        reason: 'welcome_bonus',
        note: 'نقاط ترحيبية'
      });
    }

    emit();
    return { ok:true, member };
  }

  function updateMember(phone, updates){
    const p = normalizePhone(phone);
    const members = getMembers();
    const idx = members.findIndex(m => m.phone === p);
    if (idx === -1) return false;

    const allowed = ['name','email','birthday','notes','blocked'];
    allowed.forEach(k => {
      if (updates[k] !== undefined) members[idx][k] = updates[k];
    });
    writeJSON(KEYS.MEMBERS, members);
    emit();
    return true;
  }

  function deleteMember(phone){
    const p = normalizePhone(phone);
    const members = getMembers().filter(m => m.phone !== p);
    writeJSON(KEYS.MEMBERS, members);

    // Delete transactions too
    const tx = readJSON(KEYS.TRANSACTIONS, {});
    if (tx[p]) { delete tx[p]; writeJSON(KEYS.TRANSACTIONS, tx); }

    // If it was the session, clear it
    const sess = readJSON(KEYS.SESSION, null);
    if (sess && sess.phone === p) logout();

    emit();
    return true;
  }

  /* ---------- Points (Admin-controlled) ---------- */
  function addPoints(phone, amount, reason, note){
    const p = normalizePhone(phone);
    const members = getMembers();
    const idx = members.findIndex(m => m.phone === p);
    if (idx === -1) return { ok:false, reason:'not_found' };

    amount = Math.floor(Number(amount));
    if (!amount || amount <= 0) return { ok:false, reason:'invalid_amount' };

    members[idx].points += amount;
    members[idx].lifetimePoints = (members[idx].lifetimePoints || 0) + amount;
    members[idx].lastActivity = new Date().toISOString();

    // recalc tier
    members[idx].tier = getTierId(members[idx].lifetimePoints).id;

    writeJSON(KEYS.MEMBERS, members);

    addTransaction(p, {
      type: 'earn',
      amount: amount,
      reason: reason || 'admin_add',
      note: note || ''
    });

    emit();
    return { ok:true, member: members[idx] };
  }

  function removePoints(phone, amount, reason, note){
    const p = normalizePhone(phone);
    const members = getMembers();
    const idx = members.findIndex(m => m.phone === p);
    if (idx === -1) return { ok:false, reason:'not_found' };

    amount = Math.floor(Number(amount));
    if (!amount || amount <= 0) return { ok:false, reason:'invalid_amount' };

    if (members[idx].points < amount){
      return { ok:false, reason:'insufficient', available: members[idx].points };
    }

    members[idx].points -= amount;
    // lifetime stays the same
    members[idx].lastActivity = new Date().toISOString();

    writeJSON(KEYS.MEMBERS, members);

    addTransaction(p, {
      type: 'redeem',
      amount: -amount,
      reason: reason || 'admin_remove',
      note: note || ''
    });

    emit();
    return { ok:true, member: members[idx] };
  }

  function setPoints(phone, newPoints, reason, note){
    const p = normalizePhone(phone);
    const member = getMember(p);
    if (!member) return { ok:false, reason:'not_found' };

    newPoints = Math.max(0, Math.floor(Number(newPoints) || 0));
    const diff = newPoints - member.points;

    if (diff === 0) return { ok:true, member };

    if (diff > 0){
      return addPoints(p, diff, reason || 'admin_set', note || 'تعديل يدوي');
    } else {
      return removePoints(p, -diff, reason || 'admin_set', note || 'تعديل يدوي');
    }
  }

  /* ---------- Transactions ---------- */
  function getAllTransactions(){
    return readJSON(KEYS.TRANSACTIONS, {});
  }

  function getTransactions(phone){
    const p = normalizePhone(phone);
    const all = getAllTransactions();
    return (all[p] || []).slice().sort((a,b) =>
      new Date(b.date) - new Date(a.date)
    );
  }

  function addTransaction(phone, txData){
    const p = normalizePhone(phone);
    const all = getAllTransactions();
    if (!all[p]) all[p] = [];
    all[p].push({
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      type: txData.type,          // 'earn' | 'redeem' | 'adjust'
      amount: Number(txData.amount) || 0,
      reason: txData.reason || '',
      note: txData.note || '',
      orderId: txData.orderId || '',
      date: new Date().toISOString()
    });
    writeJSON(KEYS.TRANSACTIONS, all);
  }

  /* ---------- Tiers ---------- */
  function getTierId(lifetimePoints){
    const cfg = getConfig();
    const pts = Number(lifetimePoints) || 0;
    const sorted = cfg.tiers.slice().sort((a,b) => a.minPoints - b.minPoints);
    let current = sorted[0];
    for (const t of sorted){
      if (pts >= t.minPoints) current = t;
      else break;
    }
    return current;
  }

  function getNextTier(lifetimePoints){
    const cfg = getConfig();
    const pts = Number(lifetimePoints) || 0;
    const sorted = cfg.tiers.slice().sort((a,b) => a.minPoints - b.minPoints);
    for (const t of sorted){
      if (pts < t.minPoints) return t;
    }
    return null; // already at max
  }

  function getTierProgress(lifetimePoints){
    const current = getTierId(lifetimePoints);
    const next = getNextTier(lifetimePoints);
    if (!next) return { percent: 100, current, next: null, remaining: 0 };
    const span = next.minPoints - current.minPoints;
    const gained = (Number(lifetimePoints) || 0) - current.minPoints;
    const percent = span > 0 ? Math.min(100, Math.max(0, (gained / span) * 100)) : 0;
    return {
      percent,
      current,
      next,
      remaining: Math.max(0, next.minPoints - (Number(lifetimePoints) || 0))
    };
  }

  /* ---------- Session ---------- */
  function currentPhone(){
    const s = readJSON(KEYS.SESSION, null);
    return s ? s.phone : null;
  }

  function currentMember(){
    const p = currentPhone();
    return p ? getMember(p) : null;
  }

  function login(phone){
    const p = normalizePhone(phone);
    if (!isValidPhone(p)) return { ok:false, reason:'invalid_phone' };
    const member = getMember(p);
    if (!member) return { ok:false, reason:'not_found' };
    if (member.blocked) return { ok:false, reason:'blocked' };

    writeJSON(KEYS.SESSION, {
      phone: p,
      loggedAt: new Date().toISOString()
    });

    // update lastActivity
    const members = getMembers();
    const idx = members.findIndex(m => m.phone === p);
    if (idx > -1){
      members[idx].lastActivity = new Date().toISOString();
      writeJSON(KEYS.MEMBERS, members);
    }

    emit();
    return { ok:true, member: getMember(p) };
  }

  function logout(){
    try { localStorage.removeItem(KEYS.SESSION); } catch(e){}
    emit();
  }

  function isLoggedIn(){
    return !!currentPhone() && !!currentMember();
  }

  /* ---------- Stats (for admin) ---------- */
  function getStats(){
    const members = getMembers();
    const totalPoints = members.reduce((s,m) => s + (m.points || 0), 0);
    const totalLifetime = members.reduce((s,m) => s + (m.lifetimePoints || 0), 0);
    const byTier = {};
    members.forEach(m => {
      byTier[m.tier] = (byTier[m.tier] || 0) + 1;
    });
    return {
      totalMembers: members.length,
      totalPoints,
      totalLifetime,
      avgPoints: members.length ? totalPoints / members.length : 0,
      byTier
    };
  }

  /* ---------- Events ---------- */
  const listeners = new Set();
  function emit(){
    const state = {
      member: currentMember(),
      isLoggedIn: isLoggedIn(),
      config: getConfig()
    };
    listeners.forEach(fn => {
      try { fn(state); } catch(e){}
    });
  }
  function onChange(fn){
    listeners.add(fn);
    fn({ member: currentMember(), isLoggedIn: isLoggedIn(), config: getConfig() });
    return () => listeners.delete(fn);
  }

  /* ---------- Cross-tab sync ---------- */
  window.addEventListener('storage', (e) => {
    if (e.key === KEYS.MEMBERS || e.key === KEYS.SESSION || e.key === KEYS.CONFIG || e.key === KEYS.TRANSACTIONS){
      emit();
    }
  });

  /* ---------- Public API ---------- */
    /* ============================================================
     ORDER INTEGRATION
  ============================================================ */
  function findMemberByPhone(phone){
    return getMember(phone);
  }

  /**
   * خصم نقاط عند استخدامها كخصم في الطلب
   * @param {string} phone - رقم الهاتف
   * @param {number} points - عدد النقاط المراد خصمها
   * @param {string} orderId - رقم الطلب (اختياري)
   * @returns {object} { ok, member, pointsUsed, reason }
   */
  function redeemPoints(phone, points, orderId){
    const p = normalizePhone(phone);
    const members = getMembers();
    const idx = members.findIndex(m => m.phone === p);
    if (idx === -1) return { ok:false, reason:'not_found' };

    points = Math.floor(Number(points));
    if (!points || points <= 0) return { ok:false, reason:'invalid_amount' };

    if (members[idx].points < points){
      return { ok:false, reason:'insufficient', available: members[idx].points };
    }

    members[idx].points -= points;
    members[idx].lastActivity = new Date().toISOString();
    // ملاحظة: lifetimePoints لا ينقص (يبقى سجل تاريخي)

    writeJSON(KEYS.MEMBERS, members);

    addTransaction(p, {
      type: 'redeem',
      amount: -points,
      reason: 'order_discount',
      note: orderId ? `طلب ${orderId}` : 'استخدام في الطلب',
      orderId: orderId || ''
    });

    emit();
    return { ok:true, member: members[idx], pointsUsed: points };
  }

  global.PercentLoyalty = {
    // config
    getConfig,
    setConfig,
    resetConfig,
    DEFAULT_CONFIG,

    // members
    getMembers,
    getMember,
    createMember,
    updateMember,
    deleteMember,

    // points (admin)
    addPoints,
    removePoints,
    setPoints,

    // tiers
    getTierId,
    getNextTier,
    getTierProgress,

    // transactions
    getTransactions,
    getAllTransactions,

    // session
    login,
    logout,
    currentPhone,
    currentMember,
    isLoggedIn,

    // helpers
    normalizePhone,
    isValidPhone,

       // stats
    getStats,

    // order integration
    findMemberByPhone,
    redeemPoints,

    // events
    onChange
  };

})(window);