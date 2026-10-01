import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendOrderEmail } from '../_shared/email.ts'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Used for pay-on-delivery orders. M-Pesa orders get their email from mpesa-callback once paid.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } })
    const { order_id } = await req.json()
    const { data: o } = await db.from('orders').select('*, order_items(*)').eq('id', order_id).single()
    if (!o) throw new Error('Order not found')
    if (o.payment_method !== 'cod') throw new Error('Not a pay-on-delivery order')
    await sendOrderEmail(o)
    return json({ ok: true })
  } catch (e) { return json({ error: String(e) }, 400) }
})