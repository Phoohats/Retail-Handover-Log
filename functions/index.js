// ================================================================
//  Retail-Handover-Log · Cloud Functions (idcard strategy A · ADR-001 rev)
//  รูปบัตรประชาชน = PDPA sensitive → เข้าถึงผ่าน Function เท่านั้น
//  - client อัปโหลดรูปบัตรผ่าน callable (ไม่ put ตรงเข้า Storage)
//  - Storage path .../idcard/** ตั้ง read+write:if false (client เข้าไม่ได้เลย)
//  - admin SDK bypass rules → เก็บได้; อ่านคืน base64 ต่อครั้ง (auth-gated)
//    (เลือก base64 แทน signed URL: signed URL ต้องมีสิทธิ์ IAM signBlob ที่มัก
//     ต้องตั้งเอง — base64 ทำงานทันทีบน default service account, id card น้อย+ดูไม่บ่อย)
//  ⚠️ ต้อง Firebase Blaze plan + `firebase deploy --only functions` จึงจะใช้ได้
// ================================================================
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getStorage} = require("firebase-admin/storage");

initializeApp();

const MAX_BYTES = 5 * 1024 * 1024;

// ── อัปโหลดรูปบัตร: client ส่ง base64 มา → เก็บใน path ปิด, คืนแค่ storagePath ──
exports.uploadIdCard = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "ต้อง sign-in ก่อน");
  const {recordId, idx, dataBase64, contentType} = req.data || {};
  if (!recordId || dataBase64 == null || idx == null) {
    throw new HttpsError("invalid-argument", "ต้องมี recordId, idx, dataBase64");
  }
  if (!/^[A-Za-z0-9_]+$/.test(String(recordId))) {
    throw new HttpsError("invalid-argument", "recordId ไม่ถูกต้อง");
  }
  const buf = Buffer.from(String(dataBase64).replace(/^data:[^,]+,/, ""), "base64");
  if (buf.length === 0) throw new HttpsError("invalid-argument", "ไฟล์ว่าง");
  if (buf.length > MAX_BYTES) throw new HttpsError("invalid-argument", "ไฟล์ใหญ่เกิน 5MB");

  const path = `parcelLog/${recordId}/idcard/idcard_${idx}_${Date.now()}.jpg`;
  await getStorage().bucket().file(path).save(buf, {
    contentType: contentType || "image/jpeg",
    resumable: false,
    metadata: {cacheControl: "private, max-age=0, no-store"},
  });
  return {storagePath: path}; // ⬅ ไม่คืน URL — capability ไม่รั่ว
});

// ── อ่านรูปบัตร: ตรวจ auth แล้วดาวน์โหลดไฟล์คืนเป็น base64 dataUrl ต่อครั้ง ──
exports.getIdCardImage = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "ต้อง sign-in ก่อน");
  const {storagePath} = req.data || {};
  if (!storagePath || !String(storagePath).includes("/idcard/")) {
    throw new HttpsError("invalid-argument", "storagePath ไม่ถูกต้อง");
  }
  const file = getStorage().bucket().file(String(storagePath));
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "ไม่พบไฟล์");
  const [meta] = await file.getMetadata();
  const [buf] = await file.download();
  const ct = (meta && meta.contentType) || "image/jpeg";
  return {dataUrl: `data:${ct};base64,${buf.toString("base64")}`};
});

// ── ลบรูปบัตรทั้งหมดของ record (ตอนลบรายการ) — client ลบเองไม่ได้ (write:false) ──
exports.deleteIdCards = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "ต้อง sign-in ก่อน");
  const {recordId} = req.data || {};
  if (!recordId || !/^[A-Za-z0-9_]+$/.test(String(recordId))) {
    throw new HttpsError("invalid-argument", "recordId ไม่ถูกต้อง");
  }
  await getStorage().bucket().deleteFiles({prefix: `parcelLog/${recordId}/idcard/`});
  return {ok: true};
});
