import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, money, useApp } from './lib.jsx'
import Admin, { statusLabel } from './Admin.jsx'

// Set VITE_ENABLE_MPESA=true only once a live Till/Paybill is approved.
const MPESA = import.meta.env.VITE_ENABLE_MPESA === 'true'

function GoogleButton({ onClick, label = 'Sign in with Google', big }) {
  return (
    <button className={big ? 'gbtn big' : 'gbtn'} onClick={onClick}>
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      <span>{label}</span>
    </button>
  )
}

function Back({ to = '/', children = '← Back to shop' }) { return <Link className="back" to={to}>{children}</Link> }

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Header() {
  const { user, isAdmin, count, setOpen, signIn, signOut } = useApp()
  return (
    <header className="bar">
      <Link to="/" className="brand">Corner Shop</Link>
      <nav>
        {isAdmin && <Link to="/admin">Admin</Link>}
        {user && <Link to="/orders">My orders</Link>}
        {user ? <>
          <span className="avatar" title={user.email}>{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" /> : (user.email || '?')[0].toUpperCase()}</span>
          <button className="signout" onClick={signOut}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>Sign out</button>
        </> : <GoogleButton onClick={signIn} />}
        <button className="cartbtn" onClick={() => setOpen(true)} aria-label="Open cart">Cart <b>{count}</b></button>
      </nav>
    </header>
  )
}

function Tile({ p }) {
  return p.image_url ? <img className="tile" src={p.image_url} alt={p.name} /> : <div className="tile emoji" aria-hidden>{p.emoji}</div>
}

function Qty({ p }) {
  const { cart, add } = useApp()
  const q = cart[p.id]?.qty || 0
  if (!q) return <button className="btn" onClick={() => add(p)}>Add to cart</button>
  return <div className="qty"><button onClick={() => add(p, -1)} aria-label="Remove one">−</button><span>{q}</span><button onClick={() => add(p)} aria-label="Add one">+</button></div>
}

function Shop() {
  const [products, setProducts] = useState(null)
  const [err, setErr] = useState('')
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  useEffect(() => {
    supabase.from('products').select('*').eq('in_stock', true).order('category').order('name')
      .then(({ data, error }) => error ? setErr(error.message) : setProducts(data))
  }, [])
  const cats = useMemo(() => ['All', ...new Set((products || []).map((p) => p.category))], [products])
  const shown = (products || []).filter((p) => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <main className="wrap">
      <h1 className="hero">Fresh groceries, delivered from the shop down the road.</h1>
      <div className="filters">
        <input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        <div className="chips">{cats.map((c) => <button key={c} className={c === cat ? 'chip on' : 'chip'} onClick={() => setCat(c)}>{c}</button>)}</div>
      </div>
      {err && <p className="error">Couldn't load products: {err}</p>}
      {!products && !err && <div className="grid">{[...Array(6)].map((_, i) => <div key={i} className="card skel" />)}</div>}
      {products && !shown.length && <p className="muted">Nothing matches "{q}". Try another word or category.</p>}
      <div className="grid">
        {shown.map((p) => (
          <article className="card" key={p.id}>
            <Tile p={p} />
            <h3>{p.name}</h3><p className="muted">{p.description}</p>
            <div className="row"><b>{money(p.price_cents)}</b><Qty p={p} /></div>
          </article>
        ))}
      </div>
    </main>
  )
}

function CartDrawer() {
  const { open, setOpen, items, total, add, remove } = useApp()
  const nav = useNavigate()
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [open])
  if (!open) return null
  return (
    <div className="scrim" onClick={() => setOpen(false)}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your cart">
        <div className="row"><h2>Your cart</h2><button className="link" onClick={() => setOpen(false)}>Close</button></div>
        {!items.length ? <p className="muted">Your cart is empty. Add something from the shop.</p> : items.map(({ p, qty }) => (
          <div className="line" key={p.id}><span>{p.name}<small>{money(p.price_cents)} each</small></span>
            <div className="ctl"><div className="qty"><button onClick={() => add(p, -1)} aria-label="One less">−</button><span>{qty}</span><button onClick={() => add(p)} aria-label="One more">+</button></div>
              <button className="rm" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}>Remove</button></div></div>
        ))}
        {!!items.length && <><div className="row total"><span>Total</span><b>{money(total)}</b></div>
          <button className="btn big" onClick={() => { setOpen(false); nav('/checkout') }}>Go to checkout</button></>}
      </aside>
    </div>
  )
}

function Checkout() {
  const { user, ready, items, total, clear, signIn } = useApp()
  const nav = useNavigate()
  const [f, setF] = useState({ phone: '', address: '', note: '' })
  const [method, setMethod] = useState(MPESA ? 'mpesa' : 'cod')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  if (!ready) return <main className="wrap narrow"><div className="card skel" /></main>
  if (!items.length) return <main className="wrap narrow"><h1>Checkout</h1><p className="muted">Your cart is empty.</p><Link className="btn" to="/">Browse the shop</Link></main>
  if (ready && !user) return <main className="wrap narrow"><Back /><h1>Sign in to check out</h1><p className="muted">We use your Google account so we can send your confirmation and show your order history.</p><GoogleButton big onClick={signIn} label="Continue with Google" /></main>
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (method === 'mpesa' && !/^(254|0)?[17]\d{8}$/.test(f.phone.replace(/\D/g, ''))) { setErr('Enter a valid Safaricom number, e.g. 0712 345 678'); return }
    setBusy(true)
    const { data: id, error } = await supabase.rpc('place_order', { p_items: items.map((i) => ({ id: i.p.id, qty: i.qty })), p_phone: f.phone, p_address: f.address, p_note: f.note })
    if (error) { setErr(error.message); setBusy(false); return }
    await supabase.functions.invoke(method === 'mpesa' ? 'mpesa-stk' : 'send-order-email', { body: { order_id: id } }).catch(() => {})
    clear(); nav('/order/' + id + (method === 'mpesa' ? '?mpesa=1' : ''))
  }
  return (
    <main className="wrap two">
      <form onSubmit={submit}>
        <Back />
        <h1>Delivery details</h1>
        <label>Phone number{MPESA ? ' (use your M-Pesa number)' : ''}<input required type="tel" value={f.phone} onChange={set('phone')} placeholder="0712 345 678" /></label>
        <label>Delivery address<textarea required rows={3} value={f.address} onChange={set('address')} placeholder="Building, street, landmark" /></label>
        <label>Note for the shop (optional)<input value={f.note} onChange={set('note')} /></label>
        {MPESA ? (<fieldset className="pay"><legend>How would you like to pay?</legend>
          <label className={method === 'mpesa' ? 'opt on' : 'opt'}><input type="radio" name="m" checked={method === 'mpesa'} onChange={() => setMethod('mpesa')} /> M-Pesa now <small>A prompt appears on your phone</small></label>
          <label className={method === 'cod' ? 'opt on' : 'opt'}><input type="radio" name="m" checked={method === 'cod'} onChange={() => setMethod('cod')} /> Pay on delivery <small>Cash to the rider</small></label></fieldset>) : <p className="muted">Payment: cash or M-Pesa to the rider on delivery.</p>}
        {err && <p className="error">{err}</p>}
        <button className="btn big" disabled={busy}>{busy ? 'Working…' : method === 'mpesa' ? `Pay with M-Pesa · ${money(total)}` : `Place order · ${money(total)}`}</button>
      </form>
      <aside className="summary"><h2>Order summary</h2>
        {items.map(({ p, qty }) => <div className="row" key={p.id}><span>{qty} × {p.name}</span><span>{money(p.price_cents * qty)}</span></div>)}
        <div className="row total"><span>Total</span><b>{money(total)}</b></div></aside>
    </main>
  )
}

function OrderView() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const [o, setO] = useState()
  const [busy, setBusy] = useState(false)
  const load = () => supabase.from('orders').select('*, order_items(*)').eq('id', id).single().then(({ data }) => setO(data || null))
  useEffect(() => { load() }, [id])
  const waiting = o?.payment_method === 'mpesa' && o?.payment_status === 'pending'
  useEffect(() => { if (!waiting) return; const t = setInterval(load, 3000); return () => clearInterval(t) }, [waiting])
  const retry = async () => { setBusy(true); await supabase.functions.invoke('mpesa-stk', { body: { order_id: id } }).catch(() => {}); setBusy(false); load() }
  if (o === undefined) return <main className="wrap narrow"><div className="card skel" /></main>
  if (!o) return <main className="wrap narrow"><p className="error">We couldn't find that order. Sign in with the account you ordered with.</p></main>
  const mp = o.payment_method === 'mpesa' || sp.get('mpesa')
  const needsPay = mp && ['unpaid', 'failed'].includes(o.payment_status)
  return (
    <main className="wrap narrow">
      <h1>{o.payment_status === 'paid' ? 'Payment received. Thank you!' : waiting ? 'Waiting for your payment…' : needsPay ? "Payment didn't go through" : 'Order placed. Thank you!'}</h1>
      {waiting && <p className="muted">Check your phone and enter your M-Pesa PIN. This page updates by itself.</p>}
      {needsPay && <><p className="muted">You haven't been charged. Try again, or contact the shop.</p><button className="btn" disabled={busy} onClick={retry}>{busy ? 'Sending prompt…' : 'Send M-Pesa prompt again'}</button></>}
      {!mp && <p className="muted">You'll pay on delivery. A confirmation is on its way to {o.email}.</p>}
      <p className="muted">Order #{o.id.slice(0, 8)}{o.mpesa_receipt ? ' · M-Pesa ' + o.mpesa_receipt : ''}</p>
      <p className="muted">Status: <b>{statusLabel(o.status)}</b></p>
      <div className="summary">{o.order_items.map((i) => <div className="row" key={i.id}><span>{i.qty} × {i.name}</span><span>{money(i.qty * i.unit_price_cents)}</span></div>)}
        <div className="row total"><span>Total</span><b>{money(o.total_cents)}</b></div></div>
      <p>Delivering to {o.address}</p><Link className="btn" to="/">Keep shopping</Link> <Link className="link" to="/orders">My orders</Link>
    </main>
  )
}

function Orders() {
  const { user, ready, signIn } = useApp()
  const [list, setList] = useState()
  useEffect(() => { if (user) supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data }) => setList(data || [])) }, [user])
  const badge = (o) => o.payment_status === 'paid' ? ['Paid', 'ok'] : o.payment_method === 'mpesa' ? [o.payment_status === 'pending' ? 'Awaiting payment' : 'Unpaid', 'warn'] : ['Pay on delivery', 'info']
  return (
    <main className="wrap narrow"><Back /><h1>My orders</h1>
      {ready && !user && <><p className="muted">Sign in to see your orders.</p><GoogleButton onClick={signIn} /></>}
      {user && !list && <div className="card skel" />}
      {list && !list.length && <><p className="muted">No orders yet. Your first one will show up here.</p><Link className="btn" to="/">Start shopping</Link></>}
      {(list || []).map((o) => { const [t, k] = badge(o); return (
        <Link className="card row" to={'/order/' + o.id} key={o.id}><span>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString()}<small className={'badge ' + k}>{t}</small></span><b>{money(o.total_cents)}</b></Link>) })}
    </main>
  )
}

export default function App() {
  return <><ScrollToTop /><Header /><Routes><Route path="/" element={<Shop />} /><Route path="/checkout" element={<Checkout />} /><Route path="/order/:id" element={<OrderView />} /><Route path="/orders" element={<Orders />} /><Route path="/admin" element={<Admin />} /><Route path="*" element={<main className="wrap narrow"><h1>Page not found</h1><Back /></main>} /></Routes><CartDrawer /></>
}