import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendOrderEmail } from '../_shared/email.ts'

// Called by Safaricom (no user login), so it is protected by a secret in the URL.
Deno.serve(async (req) => {
  const ok = new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { 'Content-Type': 'application/json' } })
  if (new URL(req.url).searchParams.get('s') !== Deno.env.get('MPESA_CALLBACK_SECRET')) return new Response('Forbidden', { status: 403 })
  try {
    const cb = (await req.json()).Body.stkCallback
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: o } = await db.from('orders').select('*, order_items(*)').eq('mpesa_checkout_id', cb.CheckoutRequestID).single()
    if (!o || o.payment_status === 'paid') return ok
    if (cb.ResultCode === 0) {
      const receipt = cb.CallbackMetadata?.Item?.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value
      await db.from('orders').update({ payment_status: 'paid', mpesa_receipt: receipt }).eq('id', o.id)
      await sendOrderEmail({ ...o, payment_status: 'paid', mpesa_receipt: receipt })
    } else {
      await db.from('orders').update({ payment_status: 'failed' }).eq('id', o.id)
    }
  } catch (e) { console.error(e) }
  return ok
})