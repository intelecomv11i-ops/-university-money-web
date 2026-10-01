# เงินมหาลัย — Supabase Edition

เว็บจัดการเงินมหาลัยรายสัปดาห์ 2,000 บาท พร้อม Supabase Auth, PostgreSQL และ Storage สำหรับสลิป

## 1. ตั้งค่า Supabase
1. เปิด Supabase Dashboard ของโปรเจกต์
2. ไปที่ SQL Editor
3. รัน `supabase/schema.sql` ทั้งไฟล์
4. ไปที่ Authentication > Providers > Email และเปิด Email/Password
5. ถ้าไม่ต้องการบังคับยืนยันอีเมลสำหรับเว็บส่วนตัว สามารถปิด Confirm email ได้

## 2. รันเว็บ
```bash
npm install
npm run dev
```

ไฟล์ `.env` ในชุดนี้ถูกตั้งค่าด้วย Project URL และ Publishable key ที่ผู้ใช้ให้มาแล้ว

## 3. สมัครบัญชี
- สมัครเป็น `แม่` เพื่อสร้างครอบครัว
- สมัครเป็น `ลูก` โดยใช้รหัสครอบครัว

> หลังสมัครแม่ ต้องนำ `family id` จากตาราง `families` ไปใช้สร้างรายการสัปดาห์ใน SQL Editor ตามตัวอย่างท้าย `schema.sql`

## 4. ความปลอดภัย
Publishable key ใช้ใน browser ได้ แต่ข้อมูลต้องถูกป้องกันด้วย RLS. ห้ามใส่ Secret key/service_role ใน frontend.
