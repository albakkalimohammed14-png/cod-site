// ============================================================
//  adapters.js — هنا فقط كتحط الـ API ديال Dropi و PrimeCOD
//  MOCK_MODE=true (الافتراضي) = كيخدم بداتا تجريبية بلا API
// ============================================================
const MOCK = process.env.MOCK_MODE !== 'false';

// شكل موحد ديال المنتوج — الموقع كامل كيخدم بهاد الشكل
// { id, title, description, price, currency, images[], bullets[] }

// ---------- 1) جلب المنتوج من Dropi ----------
async function fetchProduct(input) {
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
