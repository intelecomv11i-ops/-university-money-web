import { createClient } from '@supabase/supabase-js'
import './style.css'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
const app = document.querySelector('#app')
const money = n => new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(n)
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))

let state = { user:null, profile:null, payments:[] }

function authView(){
  app.innerHTML=`<main class="auth"><section class="card auth-card"><div class="brand">💸</div><h1>เงินมหาลัย</h1><p class="muted">ระบบจัดการเงินใช้จ่ายรายสัปดาห์</p><div class="tabs"><button class="tab active" data-tab="login">เข้าสู่ระบบ</button><button class="tab" data-tab="signup">สมัครบัญชี</button></div>
  <form id="authForm"><label>อีเมล<input id="email" type="email" required placeholder="example@email.com"></label><label>รหัสผ่าน<input id="password" type="password" minlength="6" required placeholder="อย่างน้อย 6 ตัวอักษร"></label><div id="signupFields" class="hidden"><label>ชื่อที่แสดง<input id="name" placeholder="เช่น แม่ / ข้าวเจ้า"></label><label>บทบาท<select id="role"><option value="mother">แม่ (ผู้ให้เงิน)</option><option value="child">ลูก (ผู้รับเงิน)</option></select></label><label>รหัสครอบครัว <span class="muted small">ลูกกรอกรหัสที่แม่สร้างไว้</span><input id="familyCode" placeholder="เช่น ABC123" autocomplete="off"></label></div><button class="primary" type="submit" id="authSubmit">เข้าสู่ระบบ</button></form><p id="authMsg" class="msg"></p></section></main>`
  let mode='login'; document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{mode=b.dataset.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelector('#signupFields').classList.toggle('hidden',mode!=='signup');document.querySelector('#authSubmit').textContent=mode==='login'?'เข้าสู่ระบบ':'สร้างบัญชี';})
  document.querySelector('#authForm').onsubmit=async e=>{e.preventDefault(); const msg=document.querySelector('#authMsg'); msg.textContent='กำลังทำรายการ...';
    const email=document.querySelector('#email').value.trim(), password=document.querySelector('#password').value, name=document.querySelector('#name')?.value.trim(), role=document.querySelector('#role')?.value, code=document.querySelector('#familyCode')?.value.trim().toUpperCase();
    if(mode==='login'){const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) msg.textContent=error.message; else await boot()}
    else {let familyId=null; if(role==='child'){if(!code){msg.textContent='ลูกต้องใส่รหัสครอบครัว';return} const {data,error}=await supabase.from('families').select('id').eq('code',code).maybeSingle(); if(error||!data){msg.textContent='ไม่พบรหัสครอบครัว';return} familyId=data.id}
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{name:name||email.split('@')[0],role, family_id:familyId}}});
      if(error){msg.textContent=error.message;return}
      if(!data.session){msg.textContent='สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ';return}
      if(role==='mother'){const {data:f,error:fe}=await supabase.from('families').insert({name:`ครอบครัว ${name||'เงินมหาลัย'}`,created_by:data.user.id}).select('id,code').single(); if(fe){msg.textContent=fe.message;return} familyId=f.id}
      const {error:pe}=await supabase.from('profiles').upsert({id:data.user.id,name:name||email.split('@')[0],role,family_id:familyId}); if(pe){msg.textContent=pe.message;return} await boot()
    }
  }
}

async function boot(){
  const {data:{user}}=await supabase.auth.getUser(); if(!user){authView();return} state.user=user
  let {data:profile,error}=await supabase.from('profiles').select('*').eq('id',user.id).single()
  if(error || !profile){await ensureProfile(user); const r=await supabase.from('profiles').select('*').eq('id',user.id).single(); profile=r.data}
  state.profile=profile; await loadPayments(); renderDashboard()
}
async function ensureProfile(user){
  const md=user.user_metadata||{}; let familyId=md.family_id||null
  if(md.role==='mother' && !familyId){const {data:f}=await supabase.from('families').insert({name:`ครอบครัว ${md.name||'เงินมหาลัย'}`,created_by:user.id}).select('id').single(); familyId=f?.id||null}
  if(md.role && familyId) await supabase.from('profiles').upsert({id:user.id,name:md.name||user.email?.split('@')[0],role:md.role,family_id:familyId})
}
async function loadPayments(){
  const {data,error}=await supabase.from('payments').select('*').order('week_no'); if(error){console.error(error);state.payments=[]} else state.payments=data||[]
}
function renderDashboard(){
 const p=state.profile, isMother=p.role==='mother'; const verified=state.payments.filter(x=>x.status==='verified').reduce((a,x)=>a+Number(x.amount),0); const planned=state.payments.reduce((a,x)=>a+Number(x.amount),0); const submitted=state.payments.filter(x=>x.status==='submitted').length;
 app.innerHTML=`<main class="page"><header class="top"><div><div class="eyebrow">OCTOBER 2026</div><h1>เงินมหาลัย</h1><p class="muted">สวัสดี ${esc(p.name)} 👋</p></div><button id="logout" class="ghost">ออกจากระบบ</button></header>
 <section class="stats"><div class="stat"><span>งบตามแผน</span><b>${money(planned)}</b></div><div class="stat"><span>รับเงินแล้ว</span><b>${money(verified)}</b></div><div class="stat"><span>รอตรวจสลิป</span><b>${submitted}</b></div></section>
 ${isMother?motherPanel():childPanel()}
 <footer>เงินมหาลัย • Supabase Auth + Database + Storage</footer></main>`
 document.querySelector('#logout').onclick=async()=>{await supabase.auth.signOut();authView()}
 bindActions()
}
function childPanel(){return `<section class="card"><div class="section-head"><div><h2>ตารางเงินรายสัปดาห์</h2><p class="muted">สัปดาห์ละ 2,000 บาท</p></div></div><div class="list">${state.payments.map(paymentRow).join('')}</div></section>`}
function motherPanel(){return `<section class="card"><div class="section-head"><div><h2>จัดการเงินให้ลูก</h2><p class="muted">ติ๊กโอนแล้วและแนบสลิปเพื่อบันทึกหลักฐาน</p></div></div><div class="list">${state.payments.map(paymentRow).join('')}</div><div class="family-box"><b>รหัสครอบครัว</b><span>${esc(state.profile.family_id ? 'ดูในฐานข้อมูล families' : '-')}</span><small>นำรหัสครอบครัวไปให้ลูกใช้ตอนสมัครบัญชี</small></div></section>`}
function paymentRow(x){const labels={pending:'ยังไม่ได้โอน',submitted:'รอตรวจสลิป',verified:'ยืนยันแล้ว',rejected:'ต้องส่งใหม่'}; const cls=x.status; const canUpload=x.status!=='verified'; return `<article class="payment ${cls}"><div class="week"><span>สัปดาห์ที่ ${x.week_no}</span><strong>${esc(x.label)}</strong></div><div class="amount">${money(x.amount)}</div><div class="status ${cls}">${labels[x.status]||x.status}</div>${canUpload?`<label class="upload">📎 แนบสลิป<input type="file" accept="image/*,application/pdf" data-upload="${x.id}"></label>`:''}${x.slip_path?`<button class="link" data-slip="${esc(x.slip_path)}">ดูสลิป</button>`:''}${x.status==='submitted'&&state.profile.role==='mother'?`<div class="actions"><button class="approve" data-verify="${x.id}">✓ ยืนยัน</button><button class="reject" data-reject="${x.id}">ส่งกลับ</button></div>`:''}</article>`}
function bindActions(){
 document.querySelectorAll('[data-upload]').forEach(inp=>inp.onchange=async()=>{const file=inp.files[0]; if(!file)return; const id=inp.dataset.upload; const row=state.payments.find(x=>x.id===id); inp.disabled=true; const ext=file.name.split('.').pop()?.toLowerCase()||'bin'; const path=`${state.profile.family_id}/${id}/${crypto.randomUUID()}.${ext}`; const {error:up}=await supabase.storage.from('slips').upload(path,file,{upsert:true,contentType:file.type}); if(up){alert(up.message);inp.disabled=false;return} const {error}=await supabase.from('payments').update({slip_path:path,status:'submitted',submitted_at:new Date().toISOString()}).eq('id',id); if(error) alert(error.message); await loadPayments();renderDashboard()})
 document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=async()=>{const {error}=await supabase.from('payments').update({status:'verified',verified_at:new Date().toISOString(),verified_by:state.user.id}).eq('id',b.dataset.verify); if(error)alert(error.message);await loadPayments();renderDashboard()})
 document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{const {error}=await supabase.from('payments').update({status:'rejected'}).eq('id',b.dataset.reject);if(error)alert(error.message);await loadPayments();renderDashboard()})
 document.querySelectorAll('[data-slip]').forEach(b=>b.onclick=async()=>{const {data,error}=await supabase.storage.from('slips').createSignedUrl(b.dataset.slip,900); if(error)alert(error.message); else window.open(data.signedUrl,'_blank')})
}
supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')authView()})
boot()
