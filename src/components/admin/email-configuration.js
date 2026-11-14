'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';

const DEFAULT_NOTIFICATIONS={orderConfirmation:true,paymentConfirmation:true,orderProcessing:true,shipped:true,outForDelivery:true,deliveryConfirmed:true,cancellationsRefunds:true,adminOrder:true,accountSecurity:true,marketing:false};
const initial={host:'',port:587,secure:false,username:'',password:'',sender:'',senderName:'NOVA',replyTo:'',recipient:'',orderNotifications:true,notifications:DEFAULT_NOTIFICATIONS};
const choices=[
 ['orderConfirmation','Customer order confirmation'],['paymentConfirmation','Payment confirmation'],['orderProcessing','Processing and packed updates'],
 ['shipped','Shipped updates'],['outForDelivery','Out for delivery'],['deliveryConfirmed','Delivery confirmation'],
 ['cancellationsRefunds','Cancellations, returns and refunds'],['adminOrder','New order alerts to admin'],['accountSecurity','Account security and welcome messages'],['marketing','Marketing (only opted-in customers)'],
];

export function EmailConfiguration(){
 const [v,setV]=useState(initial),[configured,setConfigured]=useState(false),[keyStatus,setKeyStatus]=useState(null),[storedConfigState,setStoredConfigState]=useState('unknown'),[loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState(''),[busy,setBusy]=useState(false),[testTo,setTestTo]=useState('');
 const keyConfigured=keyStatus?.valid===true;
 async function loadSettings(){
  setLoadError('');
  try{
   const r=await fetch('/api/admin/email-configuration',{cache:'no-store'});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||`Email settings request failed (${r.status})`);
   setConfigured(!!d.smtp?.hasStoredPassword);setKeyStatus(d.keyStatus||{present:!!d.keyConfigured,valid:!!d.keyConfigured,format:d.keyConfigured?'unknown':'missing'});setStoredConfigState(d.storedConfigState||'unknown');
   setV(x=>({...x,...d.smtp,notifications:{...DEFAULT_NOTIFICATIONS,...d.smtp?.notifications},password:''}));setTestTo(d.smtp?.recipient||'');
  }catch(e){setLoadError(e.message||'Could not verify email settings from the server.');}
  finally{setLoaded(true)}
 }
 useEffect(()=>{loadSettings()},[]);
 const change=(k,value)=>setV(s=>({...s,[k]:value}));
 const toggle=(k,value)=>setV(s=>({...s,notifications:{...s.notifications,[k]:value}}));
 async function save(){setBusy(true);try{const r=await fetch('/api/admin/email-configuration',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...v,port:Number(v.port)})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save email configuration');setConfigured(true);setV(s=>({...s,password:''}));toast('Encrypted SMTP settings and notification rules saved')}catch(e){toast(e.message,'error')}finally{setBusy(false)}}
 async function test(){setBusy(true);try{const r=await fetch('/api/admin/email-configuration/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:testTo})});const d=await r.json();if(!r.ok)throw new Error(d.error||'SMTP test send failed');toast(`SMTP accepted a test email for ${d.to}`)}catch(e){toast(e.message,'error')}finally{setBusy(false)}}
 return <div className="email-config-page">
  <div className="page-head"><div><h1>Email configuration</h1><p>Owner-only SMTP transport, sender identity and transactional notification controls.</p></div><span className={`pill ${configured?'delivered':'pending'}`}>{configured?'SMTP saved':'Not configured'}</span></div>
  <div className="panel" style={{marginBottom:14}}><h3>SMTP connection</h3><p className="sub">Credentials are encrypted on the server using AES-256-GCM. Passwords are write-only, never returned to this page and never stored in browser storage.</p>{!loaded&&<p className="sub" role="status">Checking the server-side SMTP key status…</p>}{loadError&&<div role="alert" className="alert error">{loadError} <button type="button" className="btn btn-outline btn-sm" onClick={loadSettings}>Retry status check</button></div>}{loaded&&!loadError&&!keyConfigured&&<p role="alert" className="alert error">{keyStatus?.present?'SMTP_CREDENTIALS_KEY is available to the server but has an invalid format. Use 32-byte Base64 or 64 hexadecimal characters.':'The SMTP key is not available to this deployment runtime. The key name is exact: SMTP_CREDENTIALS_KEY. Project metadata is not enough; this server function did not receive a value.'}</p>}{loaded&&keyConfigured&&storedConfigState==='unreadable'&&<p role="alert" className="alert error">Existing encrypted SMTP settings could not be decrypted with the configured key. They have not been overwritten. Restore the original key before changing credentials.</p>}
   <div className="form-row"><div className="field"><label htmlFor="smtp-host">SMTP host</label><input id="smtp-host" className="input" autoComplete="off" value={v.host} onChange={e=>change('host',e.target.value)} placeholder="smtp.gmail.com"/></div><div className="field"><label htmlFor="smtp-port">SMTP port</label><input id="smtp-port" className="input" type="number" min="1" max="65535" value={v.port} onChange={e=>change('port',e.target.value)}/></div><div className="field"><label htmlFor="smtp-user">SMTP username</label><input id="smtp-user" className="input" autoComplete="username" value={v.username} onChange={e=>change('username',e.target.value)} placeholder="you@gmail.com"/></div></div>
   <div className="form-row"><div className="field"><label htmlFor="smtp-pass">Gmail App Password / SMTP password</label><input id="smtp-pass" className="input" type="password" autoComplete="new-password" value={v.password} onChange={e=>change('password',e.target.value)} placeholder={configured?'Saved securely · enter only to replace':''}/><small className="sub">Google Account → Security → 2-Step Verification → App passwords. Use a generated app password, not your Google account password.</small></div><div className="field"><label htmlFor="smtp-mode">Encryption</label><select id="smtp-mode" className="input" value={v.secure?'ssl':'starttls'} onChange={e=>{const ssl=e.target.value==='ssl';change('secure',ssl);change('port',ssl?465:587)}}><option value="starttls">STARTTLS (usually port 587)</option><option value="ssl">Implicit SSL/TLS (usually port 465)</option></select></div></div>
   <div className="form-row"><div className="field"><label htmlFor="smtp-sender">Sender email</label><input id="smtp-sender" className="input" type="email" value={v.sender} onChange={e=>change('sender',e.target.value)}/></div><div className="field"><label htmlFor="smtp-name">Sender name</label><input id="smtp-name" className="input" value={v.senderName} maxLength="100" onChange={e=>change('senderName',e.target.value)}/></div><div className="field"><label htmlFor="smtp-reply">Reply-To email (optional)</label><input id="smtp-reply" className="input" type="email" value={v.replyTo||''} onChange={e=>change('replyTo',e.target.value)}/></div></div>
   <button className="btn" disabled={busy||!loaded||!!loadError||!keyConfigured||storedConfigState==='unreadable'} onClick={save}>{configured?'Update encrypted SMTP settings':'Save encrypted SMTP settings'}</button>
  </div>
  <div className="panel" style={{marginBottom:14}}><h3>Email notifications</h3><p className="sub">Each notification type can be disabled independently. Marketing mail is additionally gated by the customer’s saved marketing opt-in consent.</p><div className="email-notification-grid">{choices.map(([key,label])=><label className="switch" key={key}><input type="checkbox" checked={!!v.notifications?.[key]} onChange={e=>toggle(key,e.target.checked)}/>{label}</label>)}</div>
   <div className="field" style={{maxWidth:480,marginTop:18}}><label htmlFor="smtp-admin-to">Admin new-order notification recipient</label><input id="smtp-admin-to" className="input" type="email" value={v.recipient} onChange={e=>change('recipient',e.target.value)}/></div><label className="switch"><input type="checkbox" checked={!!v.orderNotifications} onChange={e=>change('orderNotifications',e.target.checked)}/>Enable new-order alerts</label>
  </div>
  <div className="panel"><h3>Test delivery</h3><p className="sub">Runs a real SMTP send and confirms that the server accepted the test recipient. Acceptance is not a guarantee of inbox placement.</p><div className="form-row"><div className="field"><label htmlFor="smtp-test-to">Test recipient</label><input id="smtp-test-to" className="input" type="email" value={testTo} onChange={e=>setTestTo(e.target.value)} placeholder="you@example.com"/></div><div style={{display:'flex',alignItems:'end',gap:8,marginBottom:14}}><button className="btn btn-outline" disabled={busy||!configured||!testTo} onClick={test}>Verify SMTP and send test email</button><button className="btn" disabled={busy||!loaded||!!loadError||!keyConfigured||storedConfigState==='unreadable'} onClick={save}>Save email settings</button></div></div></div>
 </div>
}
