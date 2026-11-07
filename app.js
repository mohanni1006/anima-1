'use strict';
const config={endpoint:'https://anima-1-webhook.mohanni1006.workers.dev/',notificationsEnabled:false};
const popup=document.querySelector('#welcome');
function closePopup(){popup.close()}
document.querySelector('#close').addEventListener('click',closePopup);
document.querySelector('#popup-reserve').addEventListener('click',closePopup);
popup.addEventListener('close',()=>document.body.classList.remove('modal'));
popup.showModal();document.body.classList.add('modal');
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());document.querySelector('[name=date]').min=today;
async function notify(payload){const r=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});const result=await r.json();if(!r.ok||result.ok!==true||result.eventId!==payload.eventId)throw Error('unconfirmed');return result;}
// Remains off until the existing Worker contract is verified. Visits must NEVER trigger SMS.
if(config.notificationsEnabled){try{if(!sessionStorage.getItem('anima-visit')){const eventId=crypto.randomUUID();sessionStorage.setItem('anima-visit',eventId);notify({type:'visit',eventId,path:location.pathname,sendSms:false,channels:['discord']}).catch(()=>{});}}catch{}}
let previousBody='',eventId='';
document.querySelector('#booking').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,status=document.querySelector('#status');if(!form.reportValidity())return;if(!config.notificationsEnabled){status.textContent='아직 예약이 전송되지 않았습니다. 1551-7889 전화상담 또는 문자상담으로 문의해 주세요.';return;}const data=Object.fromEntries(new FormData(form));data.phone=data.phone.replace(/\D/g,'');data.name=data.name.trim();if(!data.name||!/^01[016789]\d{7,8}$/.test(data.phone)||data.date<today){status.textContent='성함, 연락처와 방문 희망일을 확인해 주세요.';return;}const body=JSON.stringify(data);if(previousBody!==body){eventId=crypto.randomUUID();previousBody=body;}const button=form.querySelector('button');button.disabled=true;status.textContent='예약 내용을 전송하고 있습니다…';try{const result=await notify({...data,type:'reservation',eventId,consent:true});if(result.delivery?.discord!=='sent'||result.delivery?.sms!=='sent')throw Error('partial');status.textContent='방문상담 신청이 접수되었습니다. 담당자가 연락드려 일정을 확정합니다.';form.reset();previousBody='';}catch{status.textContent='접수 결과를 확인하지 못했습니다. 중복 신청 전에 1551-7889로 접수 여부를 확인해 주세요.';}finally{button.disabled=false;}});
