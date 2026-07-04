# Retail-Handover-Log

แอปบันทึกการ **รับ-ส่ง พัสดุ / เอกสาร / กุญแจ / สติ๊กเกอร์ / คีย์การ์ด / บัตรผ่านเข้า-ออก** ระหว่างโครงการ ของทีม Retail (Ananda) — ใช้หน้างานผ่านมือถือเป็นหลัก (รปภ. / นิติ / ทีม retail)

## สถานะ
🚧 **กำลังพัฒนา** — `index.html` ปัจจุบันเป็น **v1 baseline (ดีไซน์/สถาปัตยกรรมเก่า ก่อน redesign)** · กำลังจะ rebuild ตามแผนใหม่

## เอกสารสำคัญ (อ่านก่อนพัฒนาต่อ)
| ไฟล์ | คืออะไร |
|---|---|
| [HANDOFF.md](HANDOFF.md) | **เริ่มที่นี่** — สถานะงาน, next steps, blockers, สภาพแวดล้อม |
| [PLAN.md](PLAN.md) | แผนเต็ม + 16 design decisions + ADR-001 (security/PDPA) |
| [design/chosen.html](design/chosen.html) | ดีไซน์ UI ที่เลือก (Warm + ปุ่มใหญ่ + Bottom Nav) |
| [design/mockups.html](design/mockups.html) | mockup 6 แบบ (ที่มาของการเลือก) |

## Stack
- Static HTML/JS (single-file) — ไม่มี build step
- Firebase: **Firestore** (ข้อมูล) + **Storage** (รูปบัตร/พัสดุ/ลายเซ็น) + **Anonymous Auth**
- Deploy: Firebase Hosting (โปรเจกต์ `retail-mom-app`)
- Export: Excel (SheetJS) + PDF (jsPDF)

## ⚠️ ต้องตั้งค่าก่อนใช้จริง (ดู HANDOFF §5)
1. ใส่ Firebase config จริงใน `index.html` (ตอนนี้เป็น placeholder)
2. เปิด Firestore + Storage + Anonymous Auth ใน Firebase Console
3. Deploy security rules: `firestore.rules` + `storage.rules`
4. กำหนด passcode ทีม
5. ⚠️ **PDPA**: `storage.rules` ตั้งรูปบัตร ปชช. เป็น `read: if false` เข้าถึงผ่าน token เท่านั้น — อย่าแก้ให้เปิด public

## Dev / Preview
```bash
# เสิร์ฟ static ผ่าน python
python -m http.server 8800
# เปิด http://localhost:8800/
```

## Deploy (ต้องมี firebase-tools)
```bash
firebase deploy --only hosting,firestore:rules,storage
```
