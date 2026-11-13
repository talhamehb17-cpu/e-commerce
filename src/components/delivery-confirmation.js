'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, X, Truck } from './icons';

export function DeliveryConfirmation({ orderNumber }) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[response,setResponse]=useState(null),[error,setError]=useState('');
  const poll=useCallback(async()=>{
    try{
      const res=await fetch(`/api/delivery-confirmation/${encodeURIComponent(orderNumber)}`,{cache:'no-store'});
      if(!res.ok) { if(res.status!==401) console.error('Delivery reminder poll failed',res.status); return; }
      const data=await res.json();
      if(data.show) setOpen(true);
      if(data.state==='received'||data.state==='not_received') setResponse(data.state);
    }catch(e){console.error('Delivery reminder poll failed',e);}
  },[orderNumber]);
  useEffect(()=>{poll();const id=setInterval(poll,30000);return()=>clearInterval(id);},[poll]);
  async function answer(value){
    setBusy(true);setError('');
    try{
      const res=await fetch(`/api/delivery-confirmation/${encodeURIComponent(orderNumber)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({response:value})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Could not save your response.');
      setResponse(value);setOpen(false);
    }catch(e){setError(e.message);console.error('Delivery confirmation failed',e);}finally{setBusy(false);}
  }
  if(response) return <div className="delivery-response-banner" role="status"><span className="delivery-success-icon"><Check size={20}/></span><div><strong>{response==='received'?'Delivery confirmed':'We have alerted our team'}</strong><p>{response==='received'?'Thanks for confirming. Your order remains marked out for delivery until our courier confirms delivery.':'We are sorry about that. Our team has been notified and will investigate your delivery.'}</p></div></div>;
  return <>
    {open&&<div className="delivery-confirm-backdrop" role="presentation"><section className="delivery-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-confirm-title">
      <button className="delivery-confirm-close" aria-label="Close reminder" onClick={()=>setOpen(false)}><X size={17}/></button>
      <div className="delivery-truck-icon"><Truck size={25}/></div><div className="eyebrow">Order {orderNumber}</div>
      <h2 id="delivery-confirm-title">Your order is out for delivery!</h2><p>Have you received your package?</p>
      {error&&<div className="alert error" role="alert">{error}</div>}
      <div className="delivery-confirm-actions"><button className="btn delivery-yes" disabled={busy} onClick={()=>answer('received')}>{busy?'Saving…':'YES, RECEIVED'}</button><button className="btn btn-outline" disabled={busy} onClick={()=>answer('not_received')}>NO, NOT RECEIVED</button></div>
      <small>We’ll gently remind you again if you haven’t responded. This doesn’t mark the order delivered.</small>
    </section></div>}
  </>;
}
