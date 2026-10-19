// ============================================================
//  adapters.js — هنا فقط كتحط الـ API ديال Dropi و PrimeCOD
//  MOCK_MODE=true (الافتراضي) = كيخدم بداتا تجريبية بلا API
// ============================================================
const MOCK = process.env.MOCK_MODE !== 'false';

// شكل موحد ديال المنتوج — الموقع كامل كيخدم بهاد الشكل
// { id, title, description, price, currency, images[], bullets[] }

// ---------- 1) جلب المنتوج من Dropi ----------

const crypto = require('crypto');
const dec = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// ---------- جلب المنتوج من أي رابط (Amazon, Dropi, Shopify, أي موقع...) ----------
async function scrapeProduct(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', 'Accept-Language': 'es,en;q=0.8' },
    redirect: 'follow', signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Page error ' + res.status);
  const html = await res.text(), abs = u => { try { return new URL(u, url).href; } catch { return null; } };
  const meta = k => { const out = []; for (const m of html.matchAll(/<meta\s[^>]*>/gi)) { const key = (m[0].match(/(?:property|name)=["']([^"']+)["']/i) || [])[1]; if (key === k) { const c = (m[0].match(/content=["']([^"']*)["']/i) || [])[1]; if (c) out.push(dec(c)); } } return out; };
  let prod = null;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const walk = n => { if (!n || prod) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n === 'object') { if ([].concat(n['@type'] || []).includes('Product')) { prod = n; return; } walk(n['@graph']); } }; walk(JSON.parse(m[1])); } catch {}
  }
  const imgs = [], addImg = i => { if (!i) return; if (Array.isArray(i)) return i.forEach(addImg); const u = abs(typeof i === 'string' ? i : i.url); if (u && !imgs.includes(u)) imgs.push(u); };
  if (prod) addImg(prod.image); meta('og:image').forEach(addImg);
  const offer = (prod && [].concat(prod.offers || [])[0]) || {};
  const price = parseFloat(String(offer.price ?? offer.lowPrice ?? meta('product:price:amount')[0] ?? meta('og:price:amount')[0] ?? '').replace(',', '.')) || 0;
  const title = dec(String((prod && prod.name) || meta('og:title')[0] || (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '')).trim();
  if (!title || !imgs.length) throw new Error('ما لقيتش معلومات المنتوج فهاد الرابط (الموقع كيمنع القراءة)');
  return {
    id: crypto.createHash('md5').update(url).digest('hex').slice(0, 8),
    title: title.slice(0, 120),
    description: dec(String((prod && prod.description) || meta('og:description')[0] || meta('description')[0] || '')).slice(0, 600),
    price: price || 19.9, currency: 'EUR', images: imgs.slice(0, 6), bullets: [],
  };
}

async function fetchProduct(input) {
  if (/^https?:\/\//i.test(String(input).trim())) return scrapeProduct(String(input).trim());
  const id = String(input).trim().split('/').filter(Boolean).pop();
  if (MOCK) {
    return {
      id,
      title: 'Masajeador de cuello eléctrico',
      description: 'Alivia la tensión del cuello y los hombros en minutos. Batería recargable, 3 modos de intensidad y diseño ligero para usar en casa, en el coche o en la oficina.',
      price: 29.9,
      currency: 'EUR',
      images: [
        'https://placehold.co/800x800/e8eef7/14213d?text=Producto+1',
        'https://placehold.co/800x800/dfe7f3/14213d?text=Producto+2',
        'https://placehold.co/800x800/d4def0/14213d?text=Producto+3',
      ],
      bullets: ['Batería recargable USB', '3 modos de intensidad', 'Ligero y portátil', 'Garantía de 30 días'],
    };
  }

  // TODO (API): بدل هاد الـ URL والـ headers بالحقيقيين ديال Dropi
  const res = await fetch(`${process.env.DROPI_API_URL}/products/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.DROPI_API_KEY}` },
  });
  if (!res.ok) throw new Error('Dropi error ' + res.status);
  const d = await res.json();

  // TODO (API): ربط الحقول — بدل الأسماء على اليمين بالأسماء اللي كيرجع Dropi
  return {
    id,
    title: d.name,
    description: d.description,
    price: Number(d.sale_price),
    currency: 'EUR',
    images: d.images || [],
    bullets: d.features || [],
  };
}

// ---------- 2) إرسال الطلب لـ PrimeCOD ----------
// order = { product:{id,title,price}, country, qty, name, phone, address, city, zip }
async function submitOrder(order) {
  if (MOCK) return { ok: true, externalId: 'MOCK-' + Date.now() };

  // TODO (API): بدل الـ endpoint والـ body بالشكل اللي كيطلب PrimeCOD
  const res = await fetch(`${process.env.PRIMECOD_API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PRIMECOD_API_KEY}` },
    body: JSON.stringify({
      product_id: order.product.id,
      quantity: order.qty,
      country: order.country,
      customer_name: order.name,
      phone: order.phone,
      address: order.address,
      city: order.city,
      postal_code: order.zip,
      total: order.product.price * order.qty,
    }),
  });
  if (!res.ok) throw new Error('PrimeCOD error ' + res.status);
  const d = await res.json();
  return { ok: true, externalId: d.id };
}

module.exports = { fetchProduct, submitOrder };
