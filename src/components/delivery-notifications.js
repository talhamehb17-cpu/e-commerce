'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from './providers';
import { Check, X, Truck } from './icons';

export function DeliveryNotifications() {
  const store=useStore();
  const router=useRouter();
  const [queue,setQueue]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState(null);
  const [nextDueAt,setNextDueAt]=useState(null);
  const active=queue[0]||null;

  const customerId=store?.customer?.id;
  const customerIdRef=useRef(customerId);customerIdRef.current=customerId;
  useEffect(()=>{setQueue([]);setNotice(null);setError('');},[customerId]);

  const poll=useCallback(async()=>{
    if(!customerId)return;
    const requestedCustomerId=customerId;
    try{
      const response=await fetch('/api/delivery-confirmation',{cache:'no-store'});
      if(response.status===401)return;
      if(!response.ok)throw new Error('Delivery reminders will retry automatically.');
      const data=await response.json();
      if(customerIdRef.current!==requestedCustomerId)return;
      setNextDueAt(data.nextDueAt||null);
      if(data.notifications?.length){
        setQueue(current=>{
          const have=new Set(current.map(item=>item.id));
          return [...current,...data.notifications.filter(item=>!have.has(item.id))];
        });
      }
      setError('');
    }catch(e){setError(e.message||'Could not check delivery reminders.');}
  },[customerId]);

  useEffect(()=>{
    if(!customerId)return;
    poll();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')poll();},30000);
    const onOnline=()=>poll();
    const onVisible=()=>{if(document.visibilityState==='visible')poll();};
    window.addEventListener('online',onOnline);
    document.addEventListener('visibilitychange',onVisible);
    return()=>{clearInterval(timer);window.removeEventListener('online',onOnline);document.removeEventListener('visibilitychange',onVisible);};
  },[poll,customerId]);

  useEffect(()=>{
    if(!customerId||!nextDueAt)return;
    const delay=Math.max(0,Date.parse(nextDueAt)-Date.now());
    const timer=window.setTimeout(()=>{if(document.visibilityState==='visible')poll()},delay);
    return()=>window.clearTimeout(timer);
  },[customerId,nextDueAt,poll]);

  async function answer(response){
    if(!active||busy)return;
    setBusy(true);setError('');
    try{
      const result=await fetch(`/api/delivery-confirmation/${encodeURIComponent(active.order_number)}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({response}),cache:'no-store'
      });
      const data=await result.json();
      if(!result.ok)throw new Error(data.error||'Could not save your response. Please retry.');
      setQueue(items=>items.filter(item=>item.id!==active.id));
      setNotice(response);
      window.setTimeout(()=>setNotice(current=>current===response?null:current),12000);
      router.refresh();
    }catch(e){setError(e.message||'Could not save your response. Please retry.');}
    finally{setBusy(false);}
  }

  if(!store?.customer)return null;
  return <>
    {active&&<aside className="delivery-queue-card" role="dialog" aria-modal="false" aria-labelledby="delivery-queue-title" aria-live="polite">
      <header className="delivery-queue-head"><span><Truck size={17}/> Delivery check-in</span><small>{queue.length>1?`${queue.length} orders awaiting a response`: 'One order awaiting a response'}</small><button type="button" className="delivery-confirm-close" aria-label="Remind me later" onClick={()=>setQueue(items=>items.slice(1))}><X size={16}/></button></header>
      <div className="delivery-queue-body">
        {active.items?.[0]?.image_url&&<img className="delivery-queue-image" src={active.items[0].image_url} alt=""/>}
        <div className="delivery-queue-summary"><b id="delivery-queue-title">Order {active.order_number} is out for delivery</b>
          <p>{(active.items||[]).map(item=>`${item.name}${Number(item.qty)>1?` × ${item.qty}`:''}`).join(', ')||'Your order'} · Have you received it?</p>
        </div>
      </div>
      {error&&<p className="delivery-queue-error" role="alert">{error}</p>}
      <div className="delivery-queue-actions">
        <button type="button" className="btn delivery-yes" disabled={busy} onClick={()=>answer('received')}><Check size={14}/>{busy?'Saving…':'Received My Order'}</button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>answer('not_received')}>Not Received Yet</button>
      </div>
      <small className="delivery-queue-foot">Your answer is saved to your order. It won’t be marked delivered unless you confirm receipt.</small>
      {error&&<button className="delivery-queue-retry" type="button" onClick={poll}>Retry checking</button>}
    </aside>}
    {notice&&<div className="delivery-queue-toast" role="status">
      <strong>{notice==='received'?'Delivery confirmed':'We have noted the delivery issue'}</strong>
      <p>{notice==='received'?'Your order history now shows Delivered. Thank you.':'We have alerted our team. Please contact support if you need immediate help.'}</p>
      {notice==='not_received'&&<Link href="/contact">Contact support</Link>}
      <button type="button" aria-label="Dismiss message" onClick={()=>setNotice(null)}><X size={14}/></button>
    </div>}
  </>;
}
