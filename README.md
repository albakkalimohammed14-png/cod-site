# موقع COD — إسبانيا / البرتغال / إيطاليا

كيجبد المنتوج من Dropi، كيصاوب لاندينغ باج موحدة (ES / PT / IT)، والطلب كيمشي لـ PrimeCOD.
بلا أي مكتبة — غير Node.js 18 أو أكثر.

## 1) تجربة دابا (بلا API)
1. نصب Node.js من nodejs.org
2. فـ الـ terminal داخل الدوسي: `node server.js`
3. حل http://localhost:3000/admin  (اليوزر أي حاجة، كلمة السر: `change-me`)
4. لصق أي رابط وضغط "استيراد" — غادي تتصاوب صفحة بداتا تجريبية
5. جرب طلب فالصفحة، كيتسجل فـ `data/orders.json`

## 2) تربط API الحقيقي
كلشي فـ ملف واحد: `adapters.js` — لقا TODO (API):
- `fetchProduct`: URL والـ key ديال Dropi + أسماء الحقول (name, images…)
- `submitOrder`: endpoint والـ body ديال PrimeCOD

عمر `.env`:
```
MOCK_MODE=false
ADMIN_PASSWORD=كلمة-سر-قوية
WHATSAPP_NUMBER=212600000000   (اختياري: كيبان بوطون واتساب)
DROPI_API_URL=...  DROPI_API_KEY=...
PRIMECOD_API_URL=...  PRIMECOD_API_KEY=...
```
تاخد الـ API docs من الحساب ديالك فـ Dropi و PrimeCOD.

## 3) النشر (باش يكون أونلاين)
- أسهل: Render.com أو Railway.app → New Web Service → ارفع المشروع → Start command: `node server.js` → زيد المتغيرات ديال `.env` فـ Environment.
- ركب دومين ديالك من الإعدادات.
- مهم: ديال الداتا (`data/`) خاصها disk دائم، ولا بدلها بقاعدة بيانات من بعد.

## تعديل التصميم
القالب كامل فـ `server.js` داخل function `landing`، والنصوص ديال كل بلد فـ `T`.
