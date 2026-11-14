import { z } from 'zod';
import { guard, audit } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { rateLimit } from '@/lib/db';
import { readSmtpConfig, saveSmtpConfig, smtpStatus } from '@/lib/smtp-settings';
export const dynamic = 'force-dynamic';
const notificationSchema=z.object({orderConfirmation:z.boolean(),paymentConfirmation:z.boolean(),orderProcessing:z.boolean(),shipped:z.boolean(),outForDelivery:z.boolean(),deliveryConfirmed:z.boolean(),cancellationsRefunds:z.boolean(),adminOrder:z.boolean(),accountSecurity:z.boolean(),marketing:z.boolean()});
const schema = z.object({host:z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/,'Enter a hostname without scheme, path or whitespace.'),port:z.number().int().min(1).max(65535),secure:z.boolean(),username:z.string().trim().min(1).max(254),password:z.string().max(500).optional().or(z.literal('')),sender:z.string().trim().email().max(254),senderName:z.string().trim().min(1).max(100).optional(),replyTo:z.union([z.string().trim().email().max(254),z.literal('')]).optional(),recipient:z.string().trim().email().max(254),orderNotifications:z.boolean(),notifications:notificationSchema.optional()});
async function owner(){const a=await guard('settings:write');if(a.error)return a;if(a.admin.role!=='owner')return{error:'Only the store owner can manage email delivery.',status:403};return a;}
export async function GET(){const a=await owner();if(a.error)return fail(a.error,a.status);return json({smtp:await smtpStatus(),keyConfigured:!!process.env.SMTP_CREDENTIALS_KEY});}
export async function PUT(request){
 const a=await owner();if(a.error)return fail(a.error,a.status);
 if(!rateLimit(`smtp-save:${a.admin.id}`,5,60_000).ok)return fail('Too many email configuration changes. Try again later.',429);
 let body;try{body=await request.json()}catch{return fail('Invalid JSON body',400)}
 const parsed=schema.safeParse(body);if(!parsed.success)return fail(parsed.error.issues[0].message,422);
 if(!process.env.SMTP_CREDENTIALS_KEY)return fail('SMTP_CREDENTIALS_KEY is required before storing SMTP settings.',503);
 const previous=await readSmtpConfig().catch(()=>null);const d=parsed.data;
 if(!d.password&&!previous?.password)return fail('Enter the SMTP password to configure delivery.',422);
 const value={...d,senderName:d.senderName||'NOVA',replyTo:d.replyTo||'',notifications:d.notifications||previous?.notifications||{},password:d.password||previous.password};
 try{await saveSmtpConfig(value)}catch(e){return fail(e.message.includes('SMTP_CREDENTIALS_KEY')?e.message:'Could not securely save SMTP configuration.',503)}
 await audit(a.admin,'smtp_configuration_updated','settings','smtp_config',{host:d.host,port:d.port,username:d.username,recipient:d.recipient,orderNotifications:d.orderNotifications});
 return json({ok:true,smtp:{host:d.host,port:d.port,username:d.username,sender:d.sender,senderName:value.senderName,replyTo:value.replyTo,recipient:d.recipient,orderNotifications:d.orderNotifications,notifications:value.notifications,hasStoredPassword:true}});
}
