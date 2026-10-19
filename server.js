// سيرفر بلا أي مكتبة خارجية — Node 18+ فقط
const http = require('http'), fs = require('fs'), path = require('path');
try { fs.readFileSync('.env', 'utf8').split('\n').forEach(l => { const m = l.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }); } catch {}
const { fetchProduct, submitOrder } = require('./adapters');

const PORT = process.env.PORT || 3000, DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const rd = f => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f))); } catch { return []; } };
const wr = (f, d) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(d, null, 2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const body = req => new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d)); } catch { r({}); } }); });
const send = (res, code, data, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type + '; charset=utf-8' }); res.end(type === 'application/json' ? JSON.stringify(data) : data); };
const authed = req => { const b = (req.headers.authorization || '').split(' ')[1]; return !!b && Buffer.from(b, 'base64').toString().split(':').slice(1).join(':') === (process.env.ADMIN_PASSWORD || 'admin123'); };

// ---- نصوص اللاندينغ باج حسب البلد ----
const T = {
  es: { c: 'España', h: 'Pago al recibir', cta: 'Pedir ahora', name: 'Nombre completo', phone: 'Teléfono', addr: 'Dirección', city: 'Ciudad', zip: 'Código postal', qty: 'Cantidad', total: 'Total', ok: 'Pedido recibido. Te llamaremos para confirmarlo.', err: 'Revisa los datos e inténtalo de nuevo.', b1: 'Pagas cuando lo recibes', b2: 'Entrega en 24-72 h', b3: 'Devolución sencilla', wa: 'Preguntar por WhatsApp', form: 'Rellena tus datos y paga al recibir' },
  pt: { c: 'Portugal', h: 'Pagamento na entrega', cta: 'Encomendar agora', name: 'Nome completo', phone: 'Telemóvel', addr: 'Morada', city: 'Cidade', zip: 'Código postal', qty: 'Quantidade', total: 'Total', ok: 'Encomenda recebida. Vamos ligar para confirmar.', err: 'Verifique os dados e tente novamente.', b1: 'Paga quando receber', b2: 'Entrega em 24-72 h', b3: 'Devolução simples', wa: 'Perguntar no WhatsApp', form: 'Preencha os dados e pague na entrega' },
  it: { c: 'Italia', h: 'Pagamento alla consegna', cta: 'Ordina ora', name: 'Nome e cognome', phone: 'Telefono', addr: 'Indirizzo', city: 'Città', zip: 'CAP', qty: 'Quantità', total: 'Totale', ok: 'Ordine ricevuto. Ti chiameremo per confermare.', err: 'Controlla i dati e riprova.', b1: 'Paghi alla consegna', b2: 'Consegna in 24-72 h', b3: 'Reso semplice', wa: 'Chiedi su WhatsApp', form: 'Compila i dati e paga alla consegna' },
};

// ---- القالب الموحد: كل المنتوجات كيستعملو نفس التصميم ----
function landing(p, lang) {
  const t = T[lang] || T.es, wa = process.env.WHATSAPP_NUMBER;
  const money = n => Number(n).toFixed(2).replace('.', ',') + ' €';
  const waLink = wa ? `https://wa.me/${esc(wa)}?text=${encodeURIComponent(p.title)}` : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><style>
:root{--ink:#14213d;--bg:#f6f8fa;--card:#fff;--line:#dde4ee;--cta:#ffc93c;--ok:#1f8f5f}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink)}
main{max-width:560px;margin:auto;padding:0 0 96px}.top{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;font-size:14px}
.top a{color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:99px;padding:4px 12px;margin-left:4px}.top a.on{background:var(--ink);color:#fff}
.hero img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#e8eef7}.thumbs{display:flex;gap:8px;padding:8px 16px;overflow-x:auto}
.thumbs img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid transparent;cursor:pointer}.thumbs img.on{border-color:var(--ink)}
section{padding:8px 16px}h1{font-size:26px;line-height:1.2;margin:8px 0}.price{font-size:30px;font-weight:800}.badge{display:inline-block;background:#e6f5ee;color:var(--ok);font-weight:600;padding:3px 10px;border-radius:6px;font-size:14px}
ul{padding-left:20px}.trust{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;font-size:13px}.trust div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 4px}
form{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:16px}form h2{font-size:18px;margin:0 0 12px}
label{display:block;font-size:14px;margin:10px 0 4px}input,select{width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;font:inherit}
input:focus,select:focus,button:focus-visible{outline:3px solid #7aa7ff;outline-offset:1px}
button,.wa{display:block;width:100%;text-align:center;text-decoration:none;border:0;border-radius:12px;padding:15px;font:700 17px inherit;cursor:pointer;margin-top:14px}
button{background:var(--cta);color:var(--ink)}.wa{background:#25d366;color:#073b1b}.sum{display:flex;justify-content:space-between;font-weight:700;margin-top:12px}
#msg{margin-top:10px;font-weight:600}.sticky{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);padding:10px 16px}.sticky a{max-width:528px;margin:auto;display:block;background:var(--cta);color:var(--ink);text-align:center;font-weight:700;padding:13px;border-radius:12px;text-decoration:none}
</style></head><body><main>
<div class="top"><span class="badge">${t.h}</span><span>${['es', 'pt', 'it'].map(l => `<a class="${l === lang ? 'on' : ''}" href="?c=${l}">${l.toUpperCase()}</a>`).join('')}</span></div>
<div class="hero"><img id="big" src="${esc(p.images[0] || '')}" alt="${esc(p.title)}"></div>
<div class="thumbs">${p.images.map((i, k) => `<img src="${esc(i)}" class="${k ? '' : 'on'}" alt="">`).join('')}</div>
<section><h1>${esc(p.title)}</h1><div class="price">${money(p.price)}</div><ul>${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul><p>${esc(p.description)}</p>
<div class="trust"><div>${t.b1}</div><div>${t.b2}</div><div>${t.b3}</div></div></section>
<form id="f"><h2>${t.form}</h2>
<label>${t.name}</label><input name="name" required minlength="3" autocomplete="name">
<label>${t.phone}</label><input name="phone" type="tel" required minlength="9" autocomplete="tel">
<label>${t.addr}</label><input name="address" required autocomplete="street-address">
<label>${t.city}</label><input name="city" required autocomplete="address-level2">
<label>${t.zip}</label><input name="zip" required autocomplete="postal-code">
<label>${t.qty}</label><select name="qty">${[1, 2, 3, 4].map(n => `<option>${n}</option>`).join('')}</select>
<div class="sum"><span>${t.total}</span><span id="tot">${money(p.price)}</span></div>
<button>${t.cta}</button>${waLink ? `<a class="wa" href="${waLink}">${t.wa}</a>` : ''}<div id="msg" role="status"></div></form>
<div class="sticky"><a href="#f">${t.cta} · ${money(p.price)}</a></div></main>
<script>
const f=document.getElementById('f'),P=${p.price};
document.querySelectorAll('.thumbs img').forEach(i=>i.onclick=()=>{big.src=i.src;document.querySelectorAll('.thumbs img').forEach(x=>x.classList.toggle('on',x===i))});
f.qty.onchange=()=>tot.textContent=(P*f.qty.value).toFixed(2).replace('.',',')+' €';
f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;
 try{const r=await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(p.slug)},country:${JSON.stringify(lang)},...Object.fromEntries(new FormData(f))})});
 const d=await r.json();msg.style.color=d.ok?'#1f8f5f':'#c0392b';msg.textContent=d.ok?${JSON.stringify(t.ok)}:${JSON.stringify(t.err)};if(d.ok)f.reset()}
 catch{msg.textContent=${JSON.stringify(t.err)}}b.disabled=false};
</script></body></html>`;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), pth = url.pathname;
  try {
    if (pth === '/') return (res.writeHead(302, { Location: '/admin' }), res.end());
    if (pth.startsWith('/p/')) {
      const p = rd('products.json').find(x => x.slug === pth.slice(3));
      return p ? send(res, 200, landing(p, url.searchParams.get('c') || 'es'), 'text/html') : send(res, 404, 'Not found', 'text/plain');
    }
    if (pth === '/api/order' && req.method === 'POST') {
      const o = await body(req), p = rd('products.json').find(x => x.slug === o.slug);
      if (!p || !T[o.country] || !o.name || !o.phone || !o.address || !o.city || !o.zip) return send(res, 400, { ok: false });
      const order = { product: { id: p.id, title: p.title, price: p.price }, country: o.country, qty: Math.min(10, Math.max(1, +o.qty || 1)), name: o.name, phone: o.phone, address: o.address, city: o.city, zip: o.zip };
      const r = await submitOrder(order);
      const all = rd('orders.json'); all.push({ ...order, externalId: r.externalId, at: new Date().toISOString() }); wr('orders.json', all);
      return send(res, 200, { ok: true });
    }
    // كل ما تحت هنا محمي بكلمة السر
    if (pth === '/admin' || pth.startsWith('/api/')) {
      if (!authed(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="admin"' }); return res.end('Login'); }
      if (pth === '/admin') return send(res, 200, fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8'), 'text/html');
      if (pth === '/api/products') return send(res, 200, rd('products.json'));
      if (pth === '/api/orders') return send(res, 200, rd('orders.json'));
      if (pth === '/api/import' && req.method === 'POST') {
        const { input, price } = await body(req);
        if (!input) return send(res, 400, { error: 'input' });
        const p = await fetchProduct(input); if (+price > 0) p.price = +price;
        p.slug = slugify(p.title) + '-' + slugify(String(p.id)).slice(0, 8);
        const all = rd('products.json').filter(x => x.slug !== p.slug); all.unshift(p); wr('products.json', all);
        return send(res, 200, p);
      }
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) { console.error(e); send(res, 500, { error: e.message }); }
}).listen(PORT, () => console.log('http://localhost:' + PORT + '/admin'));
