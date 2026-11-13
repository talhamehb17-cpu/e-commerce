import { NextResponse } from 'next/server';
import { z } from 'zod';

export const json = (data, init) => NextResponse.json(data, init);
export const fail = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });
export const ok = (data = {}) => NextResponse.json({ ok: true, ...data });

export async function parse(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: 'Invalid JSON body' };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return { error: `${first.path.join('.') || 'input'}: ${first.message}` };
  }
  return { data: result.data };
}

export const schemas = {
  register: z.object({
    name: z.string().trim().min(2, 'Please enter your name').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters').max(120),
    marketing: z.boolean().optional(),
  }),
  login: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
  }),
  otp: z.object({
    email: z.string().trim().toLowerCase().email(),
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    purpose: z.enum(['verify_email', 'reset_password']).default('verify_email'),
  }),
  forgot: z.object({ email: z.string().trim().toLowerCase().email() }),
  reset: z.object({
    email: z.string().trim().toLowerCase().email(),
    code: z.string().trim().regex(/^\d{6}$/),
    password: z.string().min(8).max(120),
  }),
  cartAdd: z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    qty: z.number().int().min(1).max(20).default(1),
    giftNote: z.string().max(240).optional(),
  }),
  cartPatch: z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(20) }),
  address: z.object({
    id: z.string().uuid().optional(),
    label: z.string().max(40).optional(),
    fullName: z.string().trim().min(2).max(90),
    phone: z.string().trim().min(6).max(30),
    line1: z.string().trim().min(4).max(160),
    line2: z.string().trim().max(160).optional().or(z.literal('')),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().max(80).optional().or(z.literal('')),
    postalCode: z.string().trim().max(20).optional().or(z.literal('')),
    country: z.string().trim().min(2).max(80),
    isDefault: z.boolean().optional(),
  }),
  review: z.object({
    productId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(90).optional().or(z.literal('')),
    body: z.string().trim().min(12, 'Tell us a little more').max(2000),
    images: z.array(z.string().max(500)).max(4).optional(),
  }),
  checkout: z.object({
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().min(6).max(30),
    fullName: z.string().trim().min(2).max(90),
    line1: z.string().trim().min(4).max(160),
    line2: z.string().trim().max(160).optional().or(z.literal('')),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().max(80).optional().or(z.literal('')),
    postalCode: z.string().trim().max(20).optional().or(z.literal('')),
    country: z.string().trim().min(2).max(80),
    paymentMethod: z.enum(['cod', 'bank_transfer', 'easypaisa', 'jazzcash']),
    currency: z.string().trim().length(3),
    shippingMethod: z.enum(['standard', 'express']).default('standard'),
    couponCode: z.string().trim().max(40).optional().or(z.literal('')),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
    saveAddress: z.boolean().optional(),
  }),
};
