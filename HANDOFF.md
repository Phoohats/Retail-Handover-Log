# HANDOFF — แอปรับ-ส่งพัสดุ/เอกสาร/กุญแจ (Parcel-Document-Key Log)

> เขียนวันที่ 2026-07-04 · ผู้ใช้ (Plue) กำลังย้ายเครื่องทำงาน · session ใหม่อ่านไฟล์นี้แล้วทำงานต่อได้ทันที
> ภาษา: ผู้ใช้เป็น non-dev สื่อสารเป็นภาษาไทยชาวบ้าน อธิบายก่อน/หลังทุก phase (ตาม CLAUDE.md)

## 🔔 UPDATE (2026-07-04) — แยกเป็น repo ใหม่ `Retail-Handover-Log` + วิธีย้ายเครื่อง

### 🆕 การตัดสินใจ: แยกแอปนี้เป็น repo สแตนด์อะโลน
- แอปรับ-ส่ง (Handover) จะ **แยกออกมาเป็น repo ของตัวเอง ชื่อ `Retail-Handover-Log`** (ไม่อยู่ใน `Retail-MOM-DashBroad` เดิมแล้ว)
- **Plue จะสร้าง GitHub repo ใหม่ `Retail-Handover-Log` เอง** (ตอนเขียน handoff นี้ยังไม่สร้าง)
- **โครงสร้าง repo ใหม่ที่ควรจัด** (standalone):
  ```
  Retail-Handover-Log/
  ├─ index.html               ← แอปหลัก (จาก modules/Parcel_Key_Log.html rebuild ใหม่)
  ├─ firebase.json            ← hosting config (target โปรเจกต์ Firebase retail-mom-app หรือ site ใหม่)
  ├─ .firebaserc
  ├─ firestore.rules          ← security rules ตาม ADR-001
  ├─ storage.rules            ← storage rules (รูปบัตร read:false + token capability)
  ├─ README.md
  ├─ PLAN.md                  ← = PLAN_Parcel_Key_Log.md (คัดมา)
  ├─ HANDOFF.md               ← ไฟล์นี้
  ├─ design/
  │   ├─ mockups.html         ← = parcel_mockups/index.html (6 แบบ)
  │   └─ chosen.html          ← ดีไซน์ที่เลือก (Warm+ปุ่มใหญ่+Nav)
  └─ .gitignore
  ```
- **ผลกับแผน**: decision ที่เขียนว่า "reuse จาก Retail_Dashboard_2025.html" ยังใช้เป็น *reference* ได้ แต่ตอน rebuild ให้ copy โค้ด/สไตล์ที่ต้องใช้เข้ามาใน standalone แทนการ import ข้ามโปรเจกต์. ปุ่มลิงก์กลับ dashboard เดิม = optional (คนละ repo แล้ว)

### ✅ วิธีย้ายเครื่อง = ใช้ Git (แนะนำ)
- **เครื่องเดิม**: หลังจัดไฟล์เข้า repo `Retail-Handover-Log` แล้ว → commit + push ขึ้น remote ใหม่
- **เครื่องใหม่**: `git clone https://github.com/Phoohats/Retail-Handover-Log.git` → ได้ครบทันที
- งานต่อไป: แก้ → commit → push · อีกเครื่อง → pull
- **หมายเหตุ**: ไฟล์งานตอนนี้ยังอยู่ใน repo เก่า `Retail-MOM-DashBroad` (path OneDrive) — ต้อง**ย้าย/คัดไฟล์ parcel log เข้า repo ใหม่ก่อน** ตามโครงสร้างด้านบน

### 🟡 ทางเลือกสำรอง = Google Drive (cloud หลักใหม่ของผู้ใช้)
- ผู้ใช้ตั้งใจใช้ **Google Drive เป็น cloud หลัก** (แทน OneDrive)
- **⚠️ ตอนเขียน handoff นี้ เครื่องเดิม *ยังไม่มี* Google Drive for Desktop ติดตั้ง/sync** (เจอแค่ C:, D:, OneDrive) → Claude จึงก็อปเข้า Google Drive ตรงๆ ไม่ได้
- ถ้าจะใช้ Google Drive: ผู้ใช้ต้องลากโฟลเดอร์โปรเจกต์ทั้งอัน `Retail Dash Broad` เข้า Google Drive เอง (หรือให้เครื่องใหม่ clone จาก git ลงในโฟลเดอร์ Google Drive)

### ⚠️ สิ่งที่ต้องปรับบนเครื่องใหม่ (ไม่ว่าย้ายด้วยวิธีไหน)
- **Path ในเอกสารนี้เป็น path เก่า (OneDrive)** `D:\...\OneDrive - ANANDA...\Retail Dash Broad` → บนเครื่องใหม่ root จะต่าง → **ยึด relative path ในโปรเจกต์** (เช่น `modules/Parcel_Key_Log.html`) เป็นหลัก
- **`.claude/launch.json`** (preview server `dash`) hardcode path OneDrive เดิม → **ต้องแก้ `runtimeArgs` --directory ให้ชี้ path ของเครื่องใหม่** ก่อนใช้ preview
- ระวัง**โฟลเดอร์ซ้ำ 2 cloud** (ถ้ามีทั้ง OneDrive เก่า + Google Drive ใหม่) → ทำงานบนชุดเดียว กันแก้ผิดที่

## 1. งานนี้คืออะไร
สร้างแอปใหม่สำหรับ **รปภ./นิติ/ทีม retail** บันทึกการรับ-ส่ง พัสดุ/เอกสาร/กุญแจ ระหว่างโครงการ (ใช้หน้างานผ่านมือถือเป็นหลัก)
- โมดูลใหม่: `modules/Parcel_Key_Log.html` (ในโปรเจกต์ static HTML/JS นี้ · deploy ผ่าน Firebase Hosting `retail-mom-app`)
- เชื่อมปุ่มเข้าถึงจาก `Retail_Dashboard_2025.html` (header) แล้ว

## 2. เอกสารสำคัญ (อ่านก่อนเริ่ม)
- **แผนเต็ม + 16 design decisions + ADR-001**: `modules/parcel_mockups/PLAN_Parcel_Key_Log.md`
  (สำเนาจาก `~/.claude/plans/app-typed-bonbon.md` ของเครื่องเดิม — เครื่องใหม่ใช้ไฟล์ในโปรเจกต์นี้)
- **Mockup 6 แบบ (แกลเลอรีเลือกดีไซน์)**: `modules/parcel_mockups/index.html`
- **Mockup แบบที่เลือกแล้ว**: `modules/parcel_mockups/chosen.html` ← ดีไซน์เป้าหมาย

## 3. สถานะปัจจุบัน (ทำถึงไหนแล้ว)
- ✅ v1.0 ของแอป implement ไปแล้วบางส่วน (`modules/Parcel_Key_Log.html`) — มี modal form, 6 ประเภท, filter, photo base64, deliver flow, localStorage. **แต่ v1.0 นี้ยังเป็นดีไซน์/สถาปัตยกรรมเก่า** ก่อนรอบ grilling
- ✅ ผ่านรอบ **grilling** (16 decisions), **p-sieve-code** (เลือก Flow A hardened), **engineering:architecture** (ADR-001), **P-frontend** (mockup 6 แบบ + เลือกแบบผสม)
- ✅ ผู้ใช้เลือกดีไซน์: **โครง Warm (แบบ4) + ปุ่มใหญ่ Field-Ops (แบบ3) + Bottom Nav** → ดูที่ `chosen.html`
- ⏸️ **ค้างตรงนี้**: กำลังจะยืนยัน Bottom Nav (5 ช่อง: ทั้งหมด/ค้างอยู่/＋บันทึก/ส่งมอบ/รายงาน) แล้วเริ่มพัฒนาแอปจริงเต็มรูปแบบ

## 4. สิ่งที่ต้องทำต่อ (next steps)
1. **ยืนยัน Bottom Nav** กับ Plue (5 ช่องด้านบน โอเคไหม / เปลี่ยน "รายงาน"→"ค้นหา" / เพิ่มปุ่มกลับ Dashboard?)
2. **Rebuild `Parcel_Key_Log.html`** จาก v1.0 → ให้ตรงกับ 16 decisions + ADR-001 + ดีไซน์ `chosen.html`:
   - passcode gate + Firebase Anonymous Auth
   - รูปทั้งหมด (บัตร/พัสดุ/ลายเซ็น) → **Firebase Storage** (ไม่ใช่ base64) · รูปพัสดุ **บังคับทุกรายการ**
   - รูปบัตร ปชช. → `allow read: if false` + เข้าถึงผ่าน tokenized downloadURL (ADR-001)
   - ล็อกรายการ delivered ที่ Firestore rules · signature pad ตอนส่งมอบ (required)
   - filter ช่วงวันที่ + sort + ปุ่มด่วน · export Excel + PDF (2 แบบ) · UI = Warm+ปุ่มใหญ่+Nav
3. **Verify** ผ่าน preview server `dash` (`http://localhost:8800/modules/Parcel_Key_Log.html`)

## 5. ⚠️ BLOCKERS ที่ต้องให้ Plue จัดการก่อน implement เต็ม (ดู "Setup steps" ในแผน)
1. **Firebase config จริง** — ตอนนี้ในไฟล์เป็น placeholder (`YOUR_API_KEY`). Plue ต้องดึงจาก Firebase Console โปรเจกต์ `retail-mom-app` (apiKey/authDomain/projectId/storageBucket/messagingSenderId/appId)
2. **เปิด service**: Firestore + Storage + Anonymous Auth (Console)
3. **ตั้ง security rules** (Firestore + Storage) ตาม ADR-001 ในแผน
4. **กำหนด passcode** ทีม (Plue เลือกเอง)
5. **repo `Phoohats/Retail-Inspection-APP` เป็น private** → Plue จะทำ **public ชั่วคราว** เพื่อให้ดึงโค้ด **signature pad + camera capture** มา reuse (ยังทำไม่ได้ในรอบที่แล้ว เพราะ 404)

## 6. สภาพแวดล้อมเครื่อง (อาจต่างในเครื่องใหม่ — เช็คก่อน)
- เครื่องเดิม: **ไม่มี Node / npm / firebase CLI / gh CLI** → ดึง config/ deploy เองไม่ได้ ต้องพึ่ง Plue
- Preview: ใช้ `.claude/launch.json` server ชื่อ **`dash`** (python http.server :8800 เสิร์ฟ root โปรเจกต์)
- Screenshot ของ preview บางครั้ง time out (transient) — ใช้ `preview_snapshot` (DOM) ยืนยันแทนได้
- OS: Windows · shell PowerShell + Git Bash · โปรเจกต์อยู่ใน OneDrive (sync ข้ามเครื่อง)

## 7. Design decisions ที่ต้องจำ (สรุป — รายละเอียดเต็มในแผน)
รับเข้า/ส่งออก แยกจากสถานะ · สถานะ "ค้างอยู่→ส่งมอบแล้ว" · ผู้บันทึก required+จำชื่อ · รูปพัสดุบังคับ · occurredAt แก้ย้อนหลังได้ · เซ็นตอนส่งมอบบังคับ · ล็อก delivered (ปลดผ่าน Console เฟสแรก ไม่ใช่ในแอป) · โครงการ seed อังกฤษ 8 ชื่อ+เพิ่มได้ · offline = บล็อกบันทึก (รูปต้อง online)

## 8. Suggested skills (session ใหม่ควรใช้)
- **grilling** / **grill-me** — ถ้าจะถกดีไซน์/แผนต่อ (ติดตั้งแล้วในเครื่องเดิม — เครื่องใหม่อาจต้องติดตั้งซ้ำจาก github.com/mattpocock/skills/tree/main/skills/productivity/grill-me)
- **P-frontend** — ถ้าจะปรับ/ทำ UI ต่อ
- **the-validator** — ตรวจความถูกต้องก่อน deploy จริง (โดยเฉพาะ security rules PDPA)
- **firebase-firestore / firebase-security-rules-auditor / firebase-hosting-basics** — ตอน setup Firebase จริง (ตรวจ rules ให้แน่นเรื่องรูปบัตร ปชช.)
- **second-brain** — capture session สรุปเข้า vault ตอนปิดงาน (ตาม standing rule ของ Plue)

## 9. หมายเหตุความลับ
ข้อมูลโครงการ/ผู้เช่า/รูปบัตรประชาชน = ข้อมูลลับบริษัท Ananda + PDPA sensitive — อย่าเผยแพร่/อย่า deploy public โดยไม่มี security rules ที่กันรูปบัตรได้จริง
