import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const env = (k: string) => Deno.env.get(k)!

function msisdn(p: string) {
  let n = p.replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.slice(1)
  if (/^[17]\d{8}$/.test(n)) n = '254' + n
  return n
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const user = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization')! } } })
    const { order_id } = await req.json()
    const { data: o } = await user.from('orders').select('id,phone,total_cents,payment_status').eq('id', order_id).single() // RLS: own orders only
    if (!o) throw new Error('Order not found')
    if (o.payment_status === 'paid') throw new Error('Already paid')
    const phone = msisdn(o.phone)
    if (!/^254[17]\d{8}$/.test(phone)) throw new Error('Enter a valid Safaricom number, e.g. 0712345678')

    const base = env('MPESA_ENV') === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
    const tok = await (await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: 'Basic ' + btoa(env('MPESA_CONSUMER_KEY') + ':' + env('MPESA_CONSUMER_SECRET')) } })).json()
    if (!tok.access_token) throw new Error('M-Pesa authentication failed')

    const ts = new Date(Date.now() + 3 * 3600e3).toISOString().replace(/\D/g, '').slice(0, 14) // Nairobi time
    const amount = Number(Deno.env.get('MPESA_TEST_AMOUNT')) || Math.ceil(o.total_cents / 100) // test amount overrides price
    const res = await (await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: env('MPESA_SHORTCODE'), Password: btoa(env('MPESA_SHORTCODE') + env('MPESA_PASSKEY') + ts), Timestamp: ts,
        TransactionType: Deno.env.get('MPESA_TX_TYPE') ?? 'CustomerPayBillOnline',
        Amount: amount, PartyA: phone, PartyB: env('MPESA_SHORTCODE'), PhoneNumber: phone,
        CallBackURL: `${env('SUPABASE_URL')}/functions/v1/mpesa-callback?s=${env('MPESA_CALLBACK_SECRET')}`,
        AccountReference: 'Order ' + o.id.slice(0, 8), TransactionDesc: 'Shop order' }) })).json()
    if (res.ResponseCode !== '0') throw new Error(res.errorMessage || res.ResponseDescription || 'STK push failed')

    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    await admin.from('orders').update({ payment_method: 'mpesa', payment_status: 'pending', mpesa_checkout_id: res.CheckoutRequestID }).eq('id', o.id)
    return json({ ok: true })
  } catch (e) { return json({ error: String(e) }, 400) }
})