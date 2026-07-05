# ADR-002 — รูปบัตรประชาชนผ่าน Cloud Function (แทน ADR-001)

- **Status:** Accepted (2026-07-04) · **Supersedes:** ADR-001 (idcard capability pattern)
- **Context เดิม:** PLAN.md decisions 1–4 (passcode, anon auth, Storage, PDPA)

## Context — ทำไม ADR-001 ต้องถูกแทน

ADR-001 ออกแบบให้รูปบัตร ปชช. ปลอดภัยด้วย: Storage path `.../idcard/**` ตั้ง `read: if false`
แล้วเก็บ **tokenized downloadURL** ไว้ใน Firestore doc (capability pattern) — client ดึงรูปผ่าน URL นั้น.

**การทดสอบสด (2026-07-04) พิสูจน์ว่าแนวทางนี้พังบน 2 แกนอิสระ** (แก้แกนหนึ่งอีกแกนยังพัง):

| Bug | แกน | อาการ (หลักฐาน) |
|---|---|---|
| **BUG-1** | Feasibility | `ref.getDownloadURL()` ต้องมีสิทธิ์ `read` → เมื่อ `read:false` มันจึง throw `storage/unauthorized`. **บันทึกรายการบุคคลภายนอกไม่สำเร็จเลย** + รูปพัสดุค้างเป็น orphan |
| **BUG-2** | Security (PDPA) | Firebase config อยู่ใน client → ใครก็ anonymous sign-in ได้ → `firestore read: if auth!=null` ให้อ่าน `parcelLog` ทุก doc ซึ่งเก็บ tokenized URL รูปบัตร → **`read:false` ถูก bypass** ผ่าน doc |

> สรุป: การกันรูปบัตรด้วย **rules ฝั่ง client ล้วน ทำไม่ได้จริง** — invariant "รูปบัตรเข้าถึงได้เฉพาะผู้มีสิทธิ์" ต้องบังคับที่ compute ฝั่ง server ที่ bypass rules ได้ (admin SDK)

## Decision — Cloud Function (strategy A)

รูปบัตร ปชช. เข้า/ออกผ่าน **Cloud Function เท่านั้น** (`functions/index.js`):

1. **Storage** `parcelLog/{id}/idcard/**` → `allow read, write: if false` (client แตะไม่ได้เลย)
2. **`uploadIdCard(recordId, idx, dataBase64)`** — callable ตรวจ `auth` → admin SDK เขียนไฟล์ใน path ปิด → **คืนแค่ `storagePath`** (ไม่มี URL รั่ว)
3. **`getIdCardUrl(storagePath)`** — callable ตรวจ `auth` → คืน **signed URL อายุ 5 นาที** (เข้าถึงชั่วคราวต่อครั้ง)
4. Firestore doc เก็บแค่ `idCardPhotos: [{storagePath}]` — ไม่มี URL ถาวร

## Consequences

**ข้อดี**
- แก้ทั้ง BUG-1 (ไม่เรียก client `getDownloadURL` บน read:false) และ BUG-2 (ไม่มี URL ถาวรใน doc ให้รั่ว)
- รูปบัตรอ่านได้เฉพาะผ่าน function ที่ตรวจสิทธิ์ → capability ไม่ enumerate/แชร์ต่อได้

**ต้นทุน / ข้อควรระวัง**
- ต้องอัป Firebase **Blaze plan** (Cloud Functions) + `firebase deploy --only functions`
- เพิ่ม cold-start latency ตอนดูรูปบัตร (ยอมรับได้ — ดูไม่บ่อย)
- **ยังไม่ wire client** (index.html) — flip พร้อมกัน 3 จุดตอน go-live external ตาม **`functions/README.md`** (rules + client + deploy). เหตุผล: verify ไม่ได้จนกว่ามี Blaze; และกันพัง flow ที่เทสต์ผ่านแล้ว
- ระหว่างนี้: แอปใช้งานได้เต็มสำหรับ **internal** · รายการ external จะเปิดเมื่อ activate CF

## สิ่งที่ ADR-001 ทำถูก (คงไว้ ไม่แทน)
- **ล็อก `delivered` ที่ Firestore rules** — verified สด (update/delete ถูกปฏิเสธจริง)
- **defer "ปลดล็อกเพื่อแก้" ไป Firebase Console เฟสแรก** — ถูก (ไม่ต้องมี CF สำหรับ unlock)
- รูปพัสดุ/ลายเซ็นผ่าน Storage (`read: if auth`) — verified สด upload/read/delete

## Implementation notes (2026-07-04 — DEPLOYED to retail-handover-log, verified live)

3 gen2 callables live in `us-central1`: `uploadIdCard`, `getIdCardImage`, `deleteIdCards`.
Two deviations from the original sketch, both found/decided during live activation:

1. **Read returns base64, not a signed URL.** `getSignedUrl()` from Cloud Functions
   needs the runtime service account to have IAM `signBlob` (usually manual setup).
   `getIdCardImage` instead `download()`s the file and returns a base64 dataUrl —
   works on the default SA out of the box; ID cards are few + viewed rarely.
2. **Storage rule overlap had to be closed.** `read,write:if false` on
   `.../idcard/**` did **not** lock it, because the broad
   `.../{kind}/{file}` block (`read:if auth`) also matches idcard paths and
   **Storage rules are OR-ed** — the broad allow overrode the specific deny.
   Fixed by adding `&& kind != 'idcard'` to the broad block. Verified live:
   client `getDownloadURL`/`getMetadata` on an idcard path now `storage/unauthorized`.
   → [[07-Failure-Library/Failure - Firebase Storage broad wildcard match overrides a specific deny (OR-ed rules)]]

`deleteIdCards` (admin) removes the idcard folder on record delete (client can't,
write:false) so ID photos don't orphan.

## Related
- Bug detail: `reports/p-report-handover-qa-20260704.html` (BUG-1/BUG-2/BUG-11)
- Function code + checklist: `functions/index.js`, `functions/README.md`
- Rules: `firestore.rules`, `storage.rules` (deployed + verified)
