// ================================================================
//  Retail-Handover-Log · Cloud Functions (idcard strategy A · ADR-001 rev)
//  รูปบัตรประชาชน = PDPA sensitive → เข้าถึงผ่าน Function เท่านั้น
//  - client อัปโหลดรูปบัตรผ่าน callable (ไม่ put ตรงเข้า Storage)
//  - Storage path .../idcard/** ตั้ง read+write:if false (client เข้าไม่ได้เลย)
//  - admin SDK bypass rules → เก็บ/อ่านได้; อ่านคืน "signed URL อายุสั้น" ต่อครั้ง
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

// ── อ่านรูปบัตร: ตรวจ auth แล้วคืน signed URL อายุ 5 นาที (ชั่วคราวต่อครั้ง) ──
exports.getIdCardUrl = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "ต้อง sign-in ก่อน");
  const {storagePath} = req.data || {};
  if (!storagePath || !String(storagePath).includes("/idcard/")) {
    throw new HttpsError("invalid-argument", "storagePath ไม่ถูกต้อง");
  }
  const [url] = await getStorage().bucket().file(String(storagePath)).getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000, // 5 นาที
  });
  return {url};
});
