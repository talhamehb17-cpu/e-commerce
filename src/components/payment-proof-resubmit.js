'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export function PaymentProofResubmit({orderNumber,submission}){
 const [file,setFile]=useState(null),[ref,setRef]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{
  const form=new FormData();form.set('file',file);const up=await fetch('/api/payment-proof',{method:'POST',body:form}),ud=await up.json();if(!up.ok)throw new Error(ud.error||'Proof upload failed');
  const res=await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/payment-proof`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paymentProofKey:ud.proofKey,transactionReference:ref})});const d=await res.json();if(!res.ok)throw new Error(d.error||'Could not resubmit proof');router.refresh();
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="card" style={{marginBottom:14}}><h3 style={{fontSize:17,marginBottom:8}}>Payment verification</h3>
  <p className="muted" style={{fontSize:13}}>Status: <strong>{submission?.status||'pending'}</strong>{submission?.status==='rejected'&&<> · Reason: {submission.rejection_reason||'Please submit a clearer receipt.'}</>}</p>
  {submission&&<a className="link-u" href={`/api/payment-proof/${submission.id}`} target="_blank" rel="noreferrer">View submitted proof</a>}
  {submission?.status==='rejected'&&<form onSubmit={submit} style={{marginTop:14}}><div className="field"><label>New transaction reference</label><input className="input" required maxLength={120} value={ref} onChange={e=>setRef(e.target.value)}/></div><div className="field"><label>Updated receipt (image or PDF, max 4 MB)</label><input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={e=>setFile(e.target.files?.[0]||null)}/></div>{error&&<p className="alert error">{error}</p>}<button className="btn" disabled={busy||!file}>{busy?'Submitting…':'Resubmit proof'}</button></form>}
 </section>;
}
