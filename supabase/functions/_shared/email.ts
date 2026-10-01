const kes = (c: number) => 'KES ' + (c / 100).toLocaleString()

export async function sendOrderEmail(o: any) {
  const rows = o.order_items.map((i: any) => `<tr><td>${i.qty} × ${i.name}</td><td align="right">${kes(i.unit_price_cents * i.qty)}</td></tr>`).join('')
  const pay = o.payment_status === 'paid' ? `Paid via M-Pesa (receipt ${o.mpesa_receipt ?? 'n/a'}).` : 'Pay on delivery.'
  const html = `<div style="font-family:sans-serif;max-width:480px"><h2>Thanks, your order is in</h2>
    <p>Order #${o.id.slice(0, 8)}. We'll call ${o.phone} if we need anything.</p>
    <table width="100%">${rows}<tr><td><b>Total</b></td><td align="right"><b>${kes(o.total_cents)}</b></td></tr></table>
    <p>Delivering to: ${o.address}</p><p>${pay}</p></div>`
  const form = new FormData()
  form.set('from', Deno.env.get('MAILGUN_FROM')!)
  form.set('to', o.email)
  const owner = Deno.env.get('SHOP_OWNER_EMAIL'); if (owner) form.set('bcc', owner)
  form.set('subject', `Order confirmed #${o.id.slice(0, 8)}`)
  form.set('html', html)
  const base = Deno.env.get('MAILGUN_BASE') ?? 'api.mailgun.net'
  const res = await fetch(`https://${base}/v3/${Deno.env.get('MAILGUN_DOMAIN')}/messages`, {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa('api:' + Deno.env.get('MAILGUN_API_KEY')) }, body: form })
  if (!res.ok) throw new Error('Mailgun: ' + await res.text())
}