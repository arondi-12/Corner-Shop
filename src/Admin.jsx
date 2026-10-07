import { useEffect, useState } from 'react'
import { supabase, money, useApp } from './lib.jsx'

const STATUSES = [['placed', 'New'], ['preparing', 'Preparing'], ['out_for_delivery', 'Out for delivery'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']]
export const statusLabel = (s) => (STATUSES.find(([k]) => k === s) || [0, s])[1]

function OrdersTab() {
  const [orders, setOrders] = useState()
  const [show, setShow] = useState('active')
  const [err, setErr] = useState('')
  const load = () => supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
    .then(({ data, error }) => error ? setErr(error.message) : setOrders(data))
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [])
  const setStatus = async (id, status) => {
    const { error } = await supabase.rpc('set_order_status', { p_id: id, p_status: status })
    error ? setErr(error.message) : load()
  }
  const shown = (orders || []).filter((o) => show === 'all' || !['delivered', 'cancelled'].includes(o.status))
  return (
    <>
      <div className="row"><div className="chips">{[['active', 'Active'], ['all', 'All']].map(([k, l]) => <button key={k} className={show === k ? 'chip on' : 'chip'} onClick={() => setShow(k)}>{l}</button>)}</div><button className="link" onClick={load}>Refresh</button></div>
      {err && <p className="error">{err}</p>}
      {!orders && !err && <div className="card skel" />}
      {orders && !shown.length && <p className="muted">No orders here yet.</p>}
      <div className="agrid">
        {shown.map((o) => (
          <article className="card" key={o.id}>
            <div className="row"><b>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}</b>
              <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} aria-label="Order status">{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <p className="muted">{o.email} · <a href={'tel:' + o.phone}>{o.phone}</a><br />{o.address}{o.note && <><br /><i>Note: {o.note}</i></>}</p>
            {o.order_items.map((i) => <div className="row" key={i.id}><span>{i.qty} × {i.name}</span><span>{money(i.qty * i.unit_price_cents)}</span></div>)}
            <div className="row total"><span>{o.payment_status === 'paid' ? 'Paid' : o.payment_method === 'mpesa' ? 'M-Pesa ' + o.payment_status : 'Cash on delivery'}</span><b>{money(o.total_cents)}</b></div>
          </article>
        ))}
      </div>
    </>
  )
}

const blank = { name: '', description: '', category: '', price: '', emoji: '', image_url: '', in_stock: true }

function ProductRow({ p, onSaved }) {
  const [d, setD] = useState(p ? { ...blank, ...p, price: p.price_cents / 100, description: p.description || '', emoji: p.emoji || '', image_url: p.image_url || '' } : blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true); setErr('')
    const path = `${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('product-images').upload(path, f, { cacheControl: '31536000' })
    setBusy(false)
    if (error) return setErr(error.message)
    setD((x) => ({ ...x, image_url: supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl }))
  }
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    const row = { name: d.name.trim(), description: d.description, category: d.category.trim(), price_cents: Math.round(Number(d.price) * 100), emoji: d.emoji, image_url: d.image_url || null, in_stock: d.in_stock }
    const { error } = p ? await supabase.from('products').update(row).eq('id', p.id) : await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    if (!p) setD(blank)
    onSaved()
  }
  return (
    <form className="card prod" onSubmit={save}>
      <input required placeholder="Name" value={d.name} onChange={set('name')} />
      <input required placeholder="Category" value={d.category} onChange={set('category')} />
      <input required type="number" min="0" step="any" placeholder="Price (KES)" value={d.price} onChange={set('price')} />
      <input placeholder="Emoji" value={d.emoji} onChange={set('emoji')} />
      <input placeholder="Image URL (optional)" value={d.image_url} onChange={set('image_url')} />
      <label className="file">Or upload a photo<input type="file" accept="image/*" onChange={upload} /></label>
      {d.image_url && <img className="thumb" src={d.image_url} alt="Product preview" />}
      <input placeholder="Description" value={d.description} onChange={set('description')} />
      <label className="chk"><input type="checkbox" checked={d.in_stock} onChange={set('in_stock')} /> In stock</label>
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : p ? 'Save' : 'Add product'}</button>
      {err && <p className="error">{err}</p>}
    </form>
  )
}

function ProductsTab() {
  const [list, setList] = useState()
  const load = () => supabase.from('products').select('*').order('category').order('name').then(({ data }) => setList(data || []))
  useEffect(() => { load() }, [])
  return (
    <>
      <h2>Add a product</h2><ProductRow onSaved={load} />
      <h2>All products</h2>
      <p className="muted">Untick "In stock" to hide a product from the shop without deleting it.</p>
      {!list && <div className="card skel" />}
      {(list || []).map((p) => <ProductRow key={p.id} p={p} onSaved={load} />)}
    </>
  )
}

export default function Admin() {
  const { user, ready, isAdmin } = useApp()
  const [tab, setTab] = useState('orders')
  if (!ready || (user && isAdmin === null)) return <main className="wrap"><div className="card skel" /></main>
  if (!user) return <main className="wrap narrow"><h1>Shop admin</h1><p className="muted">Use the Sign in button at the top with the owner's Google account.</p></main>
  if (!isAdmin) return <main className="wrap narrow"><h1>Not authorised</h1><p className="muted">This account isn't an admin for the shop.</p></main>
  return (
    <main className="wrap">
      <h1>Shop admin</h1>
      <div className="chips" style={{ marginBottom: '1rem' }}>{[['orders', 'Orders'], ['products', 'Products']].map(([k, l]) => <button key={k} className={tab === k ? 'chip on' : 'chip'} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'orders' ? <OrdersTab /> : <ProductsTab />}
    </main>
  )
}