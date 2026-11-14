import nodemailer from 'nodemailer';
import { guard, audit } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { rateLimit } from '@/lib/db';
import { readSmtpConfig } from '@/lib/smtp-settings';
export const runtime='nodejs';
export async function POST(request){
 const {admin,error,status}=await guard('settings:write');if(error)return fail(error,status);
 if(admin.role!=='owner')return fail('Only the store owner can test email delivery.',403);
 if(!rateLimit(`smtp-test:${admin.id}`,3,60_000).ok)return fail('Test sending is rate limited. Try again later.',429);
 const config=await readSmtpConfig().catch(()=>null);if(!config?.host||!config?.username||!config?.password)return fail('Save complete SMTP settings before testing.',400);
 let body;try{body=await request.json()}catch{return fail('Invalid JSON body',400)}
 const to=String(body.to||config.recipient||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return fail('Enter a valid test recipient email.',422);
 try{
   const transport=nodemailer.createTransport({host:config.host,port:Number(config.port),secure:Boolean(config.secure),auth:{user:config.username,pass:config.password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
   const info=await transport.sendMail({from:`NOVA <${config.sender}>`,to,subject:'NOVA SMTP delivery test',text:'This message confirms that the configured NOVA SMTP transport successfully sent a test email.'});
   if(!info.accepted?.length)throw new Error('SMTP server did not accept the test recipient.');
   await audit(admin,'smtp_test_sent','email',null,{recipient:to});
   return json({ok:true,to,accepted:true});
 }catch{return fail('SMTP test send failed. Check host, port, TLS, credentials and sender authorization.',502)}
}
