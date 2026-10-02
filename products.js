/* ============================================================
   PERCENT PERFUME — Products Module (Supabase)
   ============================================================ */
(function(global){
  'use strict';

  const SUPABASE_URL = 'https://iedmrzocqgscnybpvxed.supabase.co';
  const SUPABASE_PUBLIC_KEY = 'sb_publishable_Q_vZjEcX-bN6Dkyee3jN5g_TWlovcPQ';
  
  // ⚠️ المفتاح السري — يُحدد في admin.html فقط
  // لا تضع المفتاح السري هنا! فقط اتركه فاضي، ورح يُملأ من admin.html
  const SUPABASE_ADMIN_KEY = global.__SUPABASE_ADMIN_KEY || null;

  if (typeof supabase === 'undefined'){
    console.error('Supabase SDK not loaded! Add the CDN script.');
    return;
  }

  const client = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ADMIN_KEY || SUPABASE_PUBLIC_KEY
  );

  const TAG_LABELS = {
    new:  { ar: 'جديد',          en: 'NEW'  },
    sale: { ar: 'عرض',           en: 'SALE' },
    best: { ar: 'الأكثر مبيعاً', en: 'BEST' },
    luxe: { ar: 'فاخر',          en: 'LUXE' }
  };

  let cachedProducts = [];

  /* ---------- تحويل البيانات من DB لـ JS ---------- */
  function mapFromDB(p){
    return {
      id: p.id,
      category: p.category,
      brand: p.brand,
      brandLabel: p.brand_label,
      nameAr: p.name_ar,
      nameEn: p.name_en,
      subEn: p.sub_en,
      price: Number(p.price) || 0,
      oldPrice: p.old_price != null ? Number(p.old_price) : null,
      image: p.image,
      notes: Array.isArray(p.notes) ? p.notes : [],
      tag: p.tag,
      stars: p.stars || 5,
      reviews: p.reviews || 0,
      active: p.active !== false,
      createdAt: p.created_at
    };
  }

  function mapToDB(data){
    const out = {};
    if (data.category !== undefined) out.category = data.category;
    if (data.brand !== undefined) out.brand = data.brand;
    if (data.brandLabel !== undefined) out.brand_label = data.brandLabel;
    if (data.nameAr !== undefined) out.name_ar = data.nameAr;
    if (data.nameEn !== undefined) out.name_en = data.nameEn;
    if (data.subEn !== undefined) out.sub_en = data.subEn;
    if (data.price !== undefined) out.price = Number(data.price) || 0;
    if (data.oldPrice !== undefined) out.old_price = data.oldPrice ? Number(data.oldPrice) : null;
    if (data.image !== undefined) out.image = data.image;
    if (data.notes !== undefined) out.notes = Array.isArray(data.notes) ? data.notes : [];
    if (data.tag !== undefined) out.tag = data.tag || null;
    if (data.stars !== undefined) out.stars = Number(data.stars) || 5;
    if (data.reviews !== undefined) out.reviews = Number(data.reviews) || 0;
    if (data.active !== undefined) out.active = data.active !== false;
    return out;
  }

  /* ---------- جلب المنتجات ---------- */
  async function fetchProducts(){
    const { data, error } = await client
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error){ console.error('Fetch error:', error); return cachedProducts; }
    cachedProducts = (data || []).map(mapFromDB);
    emit();
    return cachedProducts;
  }

  /* ---------- إضافة ---------- */
  async function addProduct(data){
    const payload = mapToDB(data);
    payload.id = slugify(data.nameEn) + '-' + Date.now().toString(36);
    const { error } = await client.from('products').insert(payload);
    if (error){ console.error('Add error:', error); return { ok:false, reason:error.message }; }
    await fetchProducts();
    return { ok:true };
  }

  /* ---------- تعديل ---------- */
  async function updateProduct(id, updates){
    const payload = mapToDB(updates);
    const { error } = await client.from('products').update(payload).eq('id', id);
    if (error){ console.error('Update error:', error); return { ok:false, reason:error.message }; }
    await fetchProducts();
    return { ok:true };
  }

  /* ---------- حذف ---------- */
  async function deleteProduct(id){
    const { error } = await client.from('products').delete().eq('id', id);
    if (error){ console.error('Delete error:', error); return { ok:false, reason:error.message }; }
    await fetchProducts();
    return { ok:true };
  }

  /* ---------- Helpers ---------- */
  function slugify(str){
    return String(str || '').toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/^-|-$/g, '') || 'product';
  }

  function getProducts(){ return cachedProducts; }
  function getActive(){ return cachedProducts.filter(p => p.active !== false); }
  function getByCategory(cat){ return getActive().filter(p => p.category === cat); }
  function getById(id){ return cachedProducts.find(p => p.id === id) || null; }

  /* ---------- Events ---------- */
  const listeners = new Set();
  function emit(){
    const state = { products: cachedProducts };
    listeners.forEach(fn => { try { fn(state); } catch(e){ console.error(e); } });
  }
  function onChange(fn){
    listeners.add(fn);
    fn({ products: cachedProducts });
    return () => listeners.delete(fn);
  }

  /* ---------- Realtime ---------- */
  function initRealtime(){
    try {
      client
        .channel('products-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          () => { fetchProducts(); }
        )
        .subscribe();
    } catch(e){ console.warn('Realtime failed:', e); }
  }

  /* ---------- Init ---------- */
  fetchProducts().then(() => initRealtime());

  global.PercentProducts = {
    getProducts, getActive, getByCategory, getById,
    addProduct, updateProduct, deleteProduct,
    onChange, fetchProducts, TAG_LABELS
  };

})(window);