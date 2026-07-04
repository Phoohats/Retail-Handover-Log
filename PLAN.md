# แอปรับ-ส่งพัสดุ / เอกสาร / กุญแจ (Parcel-Document-Key Log)

## Context
Plue ต้องการแอปใหม่สำหรับบันทึกการรับ-ส่ง พัสดุ/เอกสาร/กุญแจ ระหว่างบุคคลในโครงการต่างๆ (เช่น รปภ./นิติ รับพัสดุแทนผู้เช่า, ส่งมอบกุญแจให้ผู้รับเหมา ฯลฯ) โดยต้อง:
- Filter ตามโครงการได้
- ถ้าผู้รับ/ผู้ส่งเป็นพนักงานในบริษัทเดียวกัน → กรอก ชื่อ-นามสกุล, เบอร์โทร, แผนก
- ถ้าเป็นบุคคลภายนอก → ต้องแนบรูปถ่าย/สแกนบัตรประชาชน
- บันทึก Note รายการของที่รับ-ส่งได้ (กี่รายการ อะไรบ้าง)
- หลายคนหลายเครื่องต้องเห็นข้อมูลเดียวกัน (แชร์ผ่าน Firestore)
- ไม่ต้องมีระบบ login
- มีสถานะ: รอรับ → ส่งมอบแล้ว

Repo นี้ (`Retail Dash Broad`) เป็น static HTML/JS app อยู่แล้ว ใช้ Firebase Hosting + Firestore (ปัจจุบัน config เป็น placeholder ยังไม่เปิดใช้งานจริง) โปรเจกต์ Firebase คือ `retail-mom-app` (`.firebaserc`). งานนี้จะเพิ่มโมดูลใหม่โดยเดินตามแพทเทิร์นเดิมของ `Retail_Dashboard_2025.html` แทนที่จะสร้างสแตกใหม่ เพื่อให้ deploy ผ่าน Firebase Hosting เดิมได้ทันที และคุ้นเคยง่ายสำหรับ maintenance ต่อ.

## 🔎 Plan Review (2026-07-04) — audit เทียบของจริงที่สร้าง + deploy + test สด

> รีวิวผ่านเลนส์ p-sieve-code + p-architecture. Architecture 8.0/10 · ROI 9.0/10.
> integrity decisions (7/8/10) แข็งแรงมาก ผ่านทดสอบสดกับ Firebase จริง. จุดพังจริง = ADR-001 (รูปบัตร).

| # | Verdict | สถานะ/การแก้ |
|---|---|---|
| 1 Passcode | ⚠️ เหตุผลแก้แล้ว | **passcode = UX gate ไม่ใช่ data protection** (BUG-2 พิสูจน์ว่า anon อ่าน Firestore ตรงได้). PDPA กันที่ CF (ADR-002) |
| 2 Anon Auth | ⚠️ เหตุผลแก้แล้ว | `read:if auth` = "อ่านได้ทุกคนที่ยอม anon sign-in" — พอสำหรับ log ทั่วไป, **ห้ามใช้กับรูปบัตร** → ADR-002 |
| 3 รูป→Storage | ✅ ถูก | verified สด (item photo → url, ไม่ใช่ base64) |
| 4 PDPA delete | ✅ (หลังแก้ BUG-11) | ลบ storage เคยพัง (write rule กับ null resource) → guard แล้ว |
| 5/6/11 | ✅ ถูก | project list / status labels / date filter — ไม่มีปัญหา |
| 7 recordedBy required | ✅ แกร่งขึ้น | บังคับที่ server (rules) verified DENIED เมื่อว่าง |
| 8 itemPhotos ≥1 | ✅ แกร่งขึ้น | server-enforced create+update verified |
| 9 createdAt ล็อก | ✅ **แก้แล้ว** | เพิ่ม rule `createdAt == resource.data.createdAt` (invariant audit) verified DENIED |
| 10 ล็อก delivered | ✅ ดาวเด่น | verified: update/delete บน delivered ถูกปฏิเสธจริง |
| 12 Export PDF | ✅ **แก้แล้ว** | jsPDF ไทยไม่ได้ · browser-print เสี่ยงพังบน iOS/WebView → ย้ายไป **pdfmake (ฝัง Sarabun, vector ไทย) + navigator.share** (reuse pattern จาก Retail-Inspection); verified สร้าง PDF ไทย+รูป+ลายเซ็นได้จริง |
| 13/14 signature | ✅ **แก้แล้ว** | เขียน canvas signature pad เอง (ไม่รอ repo) · บังคับเซ็นตอนส่งมอบ · verified upload Storage |
| 15 UI | ✅→เปลี่ยน | Warm → Calm Soft (neumorphic เสจ) |
| 16 Offline | ✅ **แก้แล้ว** | เปิด `enablePersistence()` + block บันทึกตอน offline verified |
| **ADR-001** | ❌ **ถูกแทนด้วย [ADR-002](docs/ADR-002-idcard-cloud-function.md)** | รูปบัตร client-only ทำไม่ได้ (BUG-1+BUG-2) → Cloud Function |

## Design decisions (grilling session · 2026-07-02)
1. **Access gate**: ไม่มี login user จริง แต่ใส่ **shared passcode 1 ชั้น** ก่อนเข้าแอป (เก็บใน sessionStorage) เพื่อกันคนนอกที่บังเอิญเจอ URL เปิดดู/โหลดรูปบัตรประชาชน — ลดความเสี่ยง PDPA โดยยังกรอกข้อมูลได้เร็วหน้างาน
2. **Firestore rules**: บังคับผ่าน **Firebase Anonymous Auth** ก่อนอ่าน/เขียน (`allow read, write: if request.auth != null`) — กันการยิง API มั่วจากภายนอกระดับหนึ่ง โดย user ไม่ต้อง login เอง (แอป sign-in anonymous ให้เงียบๆ). ยอมรับว่า passcode เป็น client-side gate กันคนทั่วไปได้ ~95% ไม่กันมือโปร 100% — เพียงพอสำหรับ internal tool เฟสแรก
3. **Image storage**: เก็บรูปบัตร ปชช. ที่ **Firebase Storage** (ไม่ใช่ base64 ในตัว record) — record ใน Firestore เก็บแค่ URL/path ของรูป. เสถียรกว่า รับรูปใหญ่/หลายใบได้ ไม่ชนเพดาน 1MB/doc. ต้อง setup Firebase Storage + storage security rules (บังคับ auth เหมือน Firestore). **หมายเหตุ**: dashboard เดิมใช้ base64 — โมดูลนี้จะต่างออกไป ต้องเพิ่ม Firebase Storage SDK (`firebase-storage-compat.js`)
4. **PDPA retention**: เฟสแรกยังไม่ทำ auto-delete. ทำ 2 อย่างเบาๆ — (ก) แสดงข้อความกำกับในฟอร์มว่า "รูปบัตรใช้เพื่อยืนยันตัวตนการรับ-ส่งเท่านั้น" (แจ้งวัตถุประสงค์), (ข) ปุ่มลบรายการต้องลบทั้ง record + รูปใน Storage. Auto-delete (เช่น ลบรูปหลังส่งมอบ 90 วัน) = future enhancement

12. **Export**: ทำ **Excel (.xlsx) + PDF 2 แบบ** — Excel reuse SheetJS จาก dashboard เดิม; PDF ต้องเพิ่ม lib (jsPDF + autotable ผ่าน CDN). PDF 2 แบบ: (A) **รายงานรวม** = ตาราง list ตาม filter ส่งหัวหน้า/สรุป; (B) **ใบรับ-ส่งรายฉบับ** = 1 รายการ/1 ใบ มีรายละเอียด + รูปพัสดุ + รูปบัตร + ลายเซ็นผู้รับมอบ ไว้พิมพ์เก็บแฟ้ม/เป็นหลักฐานข้อพิพาท
13. **ลายเซ็น + ถ่ายภาพ**: reuse โค้ดต้นแบบจาก repo **`Phoohats/Retail-Inspection-APP`** (signature pad + camera capture). ⚠️ **BLOCKER (resolution chosen)**: repo private อยู่ — **Plue จะทำเป็น public ชั่วคราว** แล้วให้ Claude ดึงโค้ด signature pad + camera capture มา reuse (ปิดกลับ private ได้หลัง implement เสร็จ). รอ repo public ก่อนจึงจะ implement ส่วนนี้ได้
14. **จังหวะลายเซ็น**: **บังคับเซ็นตอน "ส่งมอบแล้ว"** (ผู้รับมอบเซ็นบนจอ + กรอกชื่อ = หลักฐานรับของจริง, เก็บลายเซ็นเป็นรูปที่ Firebase Storage). ตอน "รับเข้า" ครั้งแรก **เซ็นได้แบบ optional** (ไม่บังคับ)

11. **Filter วันที่ + เรียงลำดับ**: เพิ่ม filter ช่วงวันที่ (จาก–ถึง อิง occurredAt) + เรียงลำดับ default ใหม่สุดบน สลับเก่า↔ใหม่ได้ + ปุ่มด่วน "วันนี้" / "7 วันล่าสุด"

10. **ล็อกรายการที่ส่งมอบแล้ว**: record ที่ `status=delivered` → **ล็อกจริงที่ Firestore rules** (`allow update,delete: if resource.data.status=='pending'`) แก้/ลบไม่ได้จากหน้าปกติ. **ADR-001 ปรับ**: เฟสแรก "ปลดล็อกเพื่อแก้" ทำในแอปไม่ได้จริง (passcode client ตรวจฝั่ง server ไม่ได้ถ้าไม่มี Cloud Function) → กรณีจำเป็นแก้ผ่าน **Firebase Console** แทน. ปุ่มปลดล็อกในแอป = future (Flow B)

9. **วันเวลาที่รับ-ส่ง (occurredAt)**: เพิ่มช่อง "วันเวลาที่รับ-ส่ง" default = now แต่ **แก้ได้** (เผื่อลงย้อนหลัง). `createdAt`/`updatedAt` ระบบเก็บเงียบๆ แก้ไม่ได้ เพื่อคงร่องรอยตรวจสอบ. การ์ด/ตารางแสดง occurredAt เป็นวันหลัก

8. **รูปพัสดุ/ของ (itemPhotos)**: เพิ่มช่องแนบ **รูปตัวพัสดุ/ของ — บังคับถ่ายทุกรายการ** (required, ทั้งคนใน/คนนอก) เป็นหลักฐานสภาพ+จำนวนของ กันเคลมของหาย/เสียหาย. เก็บที่ Firebase Storage เหมือนรูปบัตร แนบได้ ~2-3 รูป. ผลลัพธ์: รายการคนนอก = ต้องมีทั้งรูปบัตร (required) + รูปพัสดุ (required); รายการคนใน = รูปพัสดุ (required)

7. **ผู้บันทึก (recordedBy)**: เปลี่ยนเป็น **บังคับกรอก (required)** ทุกรายการ เพื่อความรับผิดชอบ + **จำชื่อล่าสุดใน localStorage** เด้งอัตโนมัติครั้งต่อไป (แก้ได้ตอนเปลี่ยนกะ). คงเป็นช่องพิมพ์อิสระ ไม่ทำ dropdown รายชื่อ

6. **Status labels**: เปลี่ยนป้าย 2 สถานะให้เป็นกลาง ใช้ได้ทั้งรับเข้า/ส่งออก — `pending` = **"ค้างอยู่ / ยังไม่ส่งมอบ"** (เดิม "รอรับ"), `delivered` = **"ส่งมอบแล้ว"**. ความหมาย: ยังอยู่ในมือเรา vs ส่งต่อปลายทางแล้ว. ค่าใน DB คงเดิม (`pending`/`delivered`) เปลี่ยนแค่ข้อความแสดงผล

5. **Project list**: ใช้ **รายชื่อสะอาด (curated) เป็นภาษาอังกฤษทั้งหมด** เฉพาะโครงการที่ทีม retail ดูแลจริง เป็น seed ใน datalist + พิมพ์ชื่อใหม่เองได้เสมอ — ไม่ยกลิสต์รก ~80 ชื่อจาก dashboard มา. รายชื่อตั้งต้น (8): `IDEO Verve Ratchaprarop`, `Somerset Rama 9`, `Ashton Asoke-Rama 9`, `IDEO Sukhumvit-Rama 4`, `Culture Chula`, `Elio Sathorn-Wutthakat`, `Unio Serithai`, `IDEO Mobi Rama 9`

15. **UI direction** (จาก P-frontend mockup): **โครง Warm Reception (แบบ 4)** — ครีม-พีช มุมโค้งมน ฟอนต์ Mitr เป็นมิตร + **ปุ่มใหญ่กดง่ายแบบ Field Ops (แบบ 3)** — primary action เต็มความกว้าง touch target ใหญ่ + **Bottom Nav bar** (mobile-first). Mockup ผสม: `modules/parcel_mockups/chosen.html`. Accent เดิม Warm ส้ม `#ff8f5e` เป็นสีปุ่มหลัก

## Reference patterns to reuse (from `Retail_Dashboard_2025.html`)
- **Firebase toggle pattern** (บรรทัด ~588-610): `FIREBASE_CONFIG` object + `USE_FIREBASE` flag ที่เช็คว่า apiKey ไม่ใช่ placeholder → `firebase.initializeApp()` + `firebase.firestore()`. ใช้ Firebase v10 compat SDK ผ่าน `<script>` tag (ไม่มี build step)
- **Modal form pattern** (บรรทัด ~483-549): `.modal-overlay` > `.modal-box` > `.modal-head/.modal-body/.modal-foot`, ฟอร์มเป็น 2-column grid ด้วย `.form-group` / `.form-group.full`
- **Project field**: `<input list="projectList">` + `<datalist>` ให้พิมพ์เลือกจากที่มีอยู่ หรือพิมพ์ชื่อใหม่ได้ (ตอบโจทย์ "ใช้ชุดเดิม + เพิ่มโครงการใหม่ได้")
- **Photo upload** (บรรทัด ~1079-1122): reuse pipeline `FileReader → resize ผ่าน canvas` ของ dashboard เดิม **แต่เปลี่ยนปลายทางจาก base64-in-doc เป็นอัปขึ้น Firebase Storage** (ตามข้อ 3) — resize เหลือ ~1000px quality ~0.65 แล้ว `uploadBytes` → เก็บ `storagePath`+`downloadURL` ใน record. ใช้กับรูปบัตร/รูปพัสดุ/ลายเซ็น
- **localStorage fallback**: เก็บคู่ขนานเหมือนเดิม เผื่อ Firestore ต่อไม่ติด (offline-friendly)
- **Toast/status badge styling**: reuse `.badge-*` class conventions

## New file
สร้างไฟล์ใหม่ `modules/Parcel_Key_Log.html` (มาตรฐาน single-file HTML+JS เหมือนไฟล์อื่นใน `modules/`) แทนที่จะฝังเข้า `Retail_Dashboard_2025.html` เพราะเป็นคนละ workflow (ไม่ใช่ task tracking) — และเพิ่มลิงก์/ปุ่มเข้าถึงจากหน้า dashboard หลัก (`Retail_Dashboard_2025.html` header action bar หรือ nav) ให้เข้าถึงโมดูลนี้ได้ง่าย

### Firestore collection
ใช้ collection ใหม่แยกจาก `tasks` เดิม เช่น `parcelLog` ภายใต้โปรเจกต์ Firebase เดียวกัน (`retail-mom-app`) จะได้แชร์ config เดียวกับ dashboard หลัก ไม่ชนข้อมูลเดิม

> **หมายเหตุ**: ส่วน Data model / UI / Validation / Setup ด้านล่างนี้ **ปรับปรุงตาม 16 การตัดสินใจในโซน "Design decisions" แล้ว** — ถือเป็นสเปกล่าสุดที่จะสร้างจริง (แทนที่ของเดิมในเวอร์ชัน v1.0 ที่ implement ไปก่อนหน้า)

### Data model (field ต่อ 1 รายการ · Firestore collection `parcelLog`)
```
{
  _id, createdAt, updatedAt,       // ระบบล็อก แก้ไม่ได้ (audit)
  occurredAt: ISO,                 // วันเวลาที่รับ-ส่งจริง — default now, แก้ย้อนหลังได้ (ข้อ 9)
  project: string,                 // โครงการ (datalist EN, seed 8 ชื่อ + พิมพ์เพิ่มได้) (ข้อ 5)
  itemType: 'parcel'|'document'|'key'|'sticker'|'keycard'|'accesscard',
  direction: 'in'|'out',           // รับเข้า / ส่งออก (แยกจาก status)
  status: 'pending'|'delivered',   // ค่า DB คงเดิม; ป้ายแสดง "ค้างอยู่ → ส่งมอบแล้ว" (ข้อ 6)
  personType: 'internal'|'external',
  internalName, internalSurname, internalPhone, internalDept,   // internal (required ครบ)
  externalName,                                                 // external (optional)
  idCardPhotos: [{storagePath, url, addedAt}],   // external: required ≥1 · เก็บที่ Storage (ข้อ 3)
  itemPhotos:   [{storagePath, url, addedAt}],   // required ≥1 ทุกรายการ · Storage (ข้อ 8)
  items: [{ description, qty }],   // รายการของ + จำนวน (dynamic list, ≥1)
  notes: string,
  recordedBy: string,              // required + จำชื่อล่าสุด localStorage (ข้อ 7)
  receiveSignature: {storagePath,url} | null,   // optional ตอนรับ (ข้อ 14)
  deliveredAt, deliveredTo,        // เติมตอนส่งมอบ
  deliverSignature: {storagePath,url} | null    // required ตอนส่งมอบ (ข้อ 14)
}
```
รูปทั้งหมด (บัตร/พัสดุ/ลายเซ็น) เก็บที่ **Firebase Storage** path เช่น `parcelLog/<recordId>/<kind>_<n>.jpg` — record เก็บแค่ `storagePath` + `url`.

### UI structure
0. **Passcode gate** (ข้อ 1): หน้าแรกถาม shared passcode ก่อนเข้าแอป → ผ่านแล้วเก็บ flag ใน sessionStorage. Firebase sign-in **anonymous** เงียบๆ เพื่อผ่าน Firestore/Storage rules (ข้อ 2)
1. **Header**: ชื่อแอป + ปุ่ม "＋ บันทึกรายการใหม่" + ปุ่ม Export (Excel/PDF) + ปุ่มกลับ dashboard หลัก
2. **Filter bar**: โครงการ · ทิศทาง · ประเภท (6 แบบ) · สถานะ · **ช่วงวันที่ (จาก–ถึง)** · เรียงลำดับ (ใหม่/เก่า) · ปุ่มด่วน "วันนี้"/"7 วันล่าสุด" · search (ข้อ 11)
3. **การ์ดรายการ**: โครงการ · ทิศทาง (badge ⬇/⬆) · ประเภท · ผู้เกี่ยวข้อง (+thumbnail บัตร/พัสดุ) · จำนวนของ · สถานะ ("ค้างอยู่/ส่งมอบแล้ว") · occurredAt · ผู้บันทึก. รายการ `delivered` = **ล็อก** เหลือแค่ "ดูรายละเอียด" + "ปลดล็อก (passcode)" (ข้อ 10)
4. **Modal บันทึก/แก้ไข**:
   - โครงการ (datalist EN) · **occurredAt** (default now, แก้ได้)
   - ทิศทาง: radio รับเข้า/ส่งออก (required, แถวแรก)
   - ประเภท: radio 6 แบบ (📦📄🔑🏷️💳🎫) grid หลายแถว
   - **รูปพัสดุ/ของ (required ≥1)** — ปุ่มถ่ายรูป/แนบ, `capture="environment"`, อัป Storage (ข้อ 8)
   - ประเภทบุคคล: radio ภายใน/ภายนอก → toggle:
     - ภายใน: ชื่อ, นามสกุล, เบอร์โทร, แผนก (required ครบ)
     - ภายนอก: ชื่อ (optional) + **รูปบัตร ปชช. (required ≥1, ≤2 รูป)** + ข้อความกำกับ PDPA "รูปบัตรใช้เพื่อยืนยันตัวตนการรับ-ส่งเท่านั้น" (ข้อ 4)
   - รายการของ (dynamic list ≥1) · หมายเหตุ · **ผู้บันทึก (required, prefill ชื่อล่าสุด)**
   - ลายเซ็นผู้ส่ง/รับ ตอนรับ (optional) — signature pad (reuse Retail-Inspection-APP)
   - ปุ่ม บันทึก / ยกเลิก
5. **เปลี่ยนสถานะ → ส่งมอบ**: ปุ่ม "✅ ส่งมอบแล้ว" → modal กรอกชื่อผู้รับมอบ + **ลายเซ็นผู้รับมอบ (required)** + occurredAt ของการส่งมอบ → อัปเดต `status`, `deliveredAt`, `deliveredTo`, `deliverSignature` แล้ว **ล็อก record**
6. **Export**: Excel (SheetJS) · PDF รายงานรวม (jsPDF+autotable) · PDF ใบรับ-ส่งรายฉบับ (รายละเอียด+รูป+ลายเซ็น) (ข้อ 12)

### Validation rules (client-side)
- ต้องผ่าน passcode + anonymous sign-in สำเร็จ ก่อนใช้งาน
- โครงการ, ทิศทาง, ประเภท, occurredAt = required เสมอ
- **รูปพัสดุ ≥1 รูป เสมอ**
- internal → ชื่อ/นามสกุล/เบอร์/แผนก ครบ; external → รูปบัตร ≥1 (≤2)
- items ≥1 รายการ · **ผู้บันทึก required**
- ตอนกดส่งมอบ → ชื่อผู้รับมอบ + ลายเซ็นผู้รับมอบ required
- แก้/ลบ record ที่ `delivered` → ต้องใส่ passcode ปลดล็อกก่อน

## Setup steps (ก่อนเริ่มเขียนโค้ด · ต้องให้ Plue ทำ/ให้ข้อมูล)
1. **Firebase config จริง**: Plue ดึงจาก Firebase Console (โปรเจกต์ `retail-mom-app`) → apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId → ใส่ในไฟล์แอป (และ dashboard หลักถ้าจะเปิด Firestore ด้วย)
2. **เปิด Firebase services**: Firestore + **Storage** + **Anonymous Authentication** (Console → Authentication → Sign-in method → Anonymous → Enable)
3. **Security rules** (ADR-001 — สำคัญเรื่อง PDPA):
   - **Firestore**: `read: if auth!=null`; `create: if auth!=null && recordedBy ยาว>0 && itemPhotos>=1`; `update,delete: if auth!=null && resource.data.status=='pending'` (ล็อก delivered จริง)
   - **Storage รูปบัตร** `parcelLog/{id}/idcard/{file}`: `write: if auth!=null && size<5MB && image/*`; **`read: if false`** — เข้าถึงรูปบัตรเฉพาะผ่าน tokenized downloadURL ที่เก็บใน Firestore doc (capability pattern, enumerate ไม่ได้)
   - **Storage รูปพัสดุ/ลายเซ็น**: `read: if auth!=null`
   - **Offline**: บล็อกการบันทึกรายการใหม่เมื่อออฟไลน์ (รูป required ต้องใช้ Storage) + Firestore persistence สำหรับอ่าน/ filter ตอนเน็ตหลุด
4. **Passcode**: Plue กำหนดรหัสรวมของทีม (hardcode/หรือเก็บใน config) — ยอมรับว่าเป็น client-side gate
5. **repo `Retail-Inspection-APP` เป็น public ชั่วคราว** → Claude ดึงโค้ด signature pad + camera capture มา reuse (ปิดกลับ private ได้หลังเสร็จ)
6. เพิ่ม CDN: `firebase-storage-compat.js`, `firebase-auth-compat.js`, jsPDF + jspdf-autotable, (SheetJS มีใน dashboard เดิมแล้ว)

## Verification
1. **Passcode + auth**: ใส่ passcode ผิด→เข้าไม่ได้; ถูก→เข้าได้ + anonymous sign-in สำเร็จ (เช็ค Firebase Console → Authentication เห็น anon user)
2. **บันทึก internal**: field ครบ validate ถูก + รูปพัสดุ required + อัปขึ้น Storage ได้ (เช็ค Console → Storage เห็นไฟล์)
3. **บันทึก external**: รูปบัตร required (≤2) + ข้อความ PDPA แสดง + รูปขึ้น Storage + record ใน Firestore เก็บ URL ไม่ใช่ base64
4. **Filter/sort**: โครงการ/ทิศทาง/ประเภท/สถานะ/ช่วงวันที่/ปุ่มด่วน/เรียงลำดับ ทำงานถูก
5. **ส่งมอบ**: กดส่งมอบ → บังคับชื่อ+ลายเซ็นผู้รับมอบ → อัปเดต + **record ล็อก** (ปุ่มแก้/ลบหาย) → ทดสอบปลดล็อกด้วย passcode
6. **Export**: Excel เปิดได้ · PDF รายงานรวม · PDF ใบรับ-ส่งรายฉบับ (มีรูป+ลายเซ็น) ออกถูกต้อง
7. **Multi-device sync**: เปิด 2 เครื่อง/แท็บ เห็นข้อมูลตรงกันผ่าน Firestore
8. **Mobile viewport**: ถ่ายรูปบัตร/พัสดุ + เซ็นลายเซ็นบนมือถือใช้งานสะดวก
9. **Firestore ต่อไม่ติด**: fallback localStorage ยังกรอกได้ (แต่รูป/ลายเซ็นที่ต้องใช้ Storage จะจำกัด — ระบุพฤติกรรม offline ให้ชัดตอน implement)
3. ทดสอบกรณี Firestore ต่อไม่ติด (fallback localStorage ยังใช้งานได้)
