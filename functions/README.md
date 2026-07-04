# ID Card via Cloud Function — activation checklist (strategy A)

รูปบัตรประชาชน = PDPA sensitive. ดีไซน์เดิม ("Storage `read:false` + เก็บ tokenized URL ใน Firestore")
**ทำ client-only ไม่ได้จริง** และถึงทำได้ก็รั่ว (ดู P-report BUG-1 / BUG-2). ทางที่เลือก = **A · Cloud Function**.

โค้ด function พร้อมแล้วใน `functions/index.js` (`uploadIdCard`, `getIdCardUrl`).
**ยังไม่ wire เข้า client** เพราะ verify ไม่ได้จนกว่าจะมี Firebase จริง — flip ทั้ง 3 จุดพร้อมกันตอนตั้งค่า:

## ต้องทำพร้อมกัน (ตอนเปิด Firebase จริง)

### 1) Firebase project
- อัปเกรดเป็น **Blaze plan** (Cloud Functions ต้องใช้)
- `cd functions && npm install`
- `firebase deploy --only functions`

### 2) `storage.rules` — ปิด idcard ไม่ให้ client แตะเลย (ให้ผ่าน function อย่างเดียว)
เปลี่ยน block `match /parcelLog/{recordId}/idcard/{file}` เป็น:
```
match /parcelLog/{recordId}/idcard/{file} {
  allow read, write: if false;   // admin SDK (functions) เท่านั้น — client เข้าไม่ได้
}
```

### 3) `index.html` — เปลี่ยน 2 จุดให้รูปบัตรวิ่งผ่าน function

**a. ตอนเซฟ** — ใน `processPhotos()` / `uploadPhoto()` ให้ kind==="idcard" เรียก callable แทน client put:
```js
// ก่อน init: const fns = firebase.functions();
async function uploadIdCardViaFn(recordId, idx, ph){
  const dataBase64 = ph.dataUrl || await blobToDataUrl(ph.blob);
  const r = await fns.httpsCallable("uploadIdCard")({recordId, idx, dataBase64});
  return { storagePath: r.data.storagePath, addedAt: new Date().toISOString() }; // ไม่มี url
}
```
แล้วใน `processPhotos(recordId,"idcard",arr)` route ไป `uploadIdCardViaFn` แทน `uploadPhoto`.

**b. ตอนแสดงรูปบัตร** — `imgSrc()` ของ idcard ไม่มี `url`/`dataUrl` แล้ว ต้องขอ signed URL ตอนเปิด:
```js
async function idCardUrl(ph){
  if(ph.dataUrl) return ph.dataUrl;                 // fallback localStorage
  const r = await fns.httpsCallable("getIdCardUrl")({storagePath: ph.storagePath});
  return r.data.url;                                // อายุ 5 นาที
}
```
ใช้ใน `openDetail()` gallery รูปบัตร (โหลดแบบ lazy ตอนกดดู) และ `printSlip()`.

### 4) เพิ่ม SDK
`<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js"></script>`

## ผลลัพธ์ด้านความปลอดภัย
- รูปบัตรไม่มี public token ที่ไหนเลย · Firestore doc เก็บแค่ `storagePath`
- อ่านได้เฉพาะผ่าน function ที่เช็ค auth → คืน signed URL อายุ 5 นาที
- แก้ BUG-1 (ไม่เรียก client `getDownloadURL` บน read:false) + BUG-2 (ไม่มี URL รั่วใน doc)
