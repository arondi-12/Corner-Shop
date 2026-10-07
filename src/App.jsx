import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, money, useApp } from './lib.jsx'
import Admin, { statusLabel } from './Admin.jsx'
import Privacy from './Privacy.jsx'

const E = import.meta.env
const SHOP = { name: E.VITE_SHOP_NAME || 'Corner Shop', phone: E.VITE_SHOP_PHONE, email: E.VITE_SHOP_EMAIL, address: E.VITE_SHOP_ADDRESS, hours: E.VITE_SHOP_HOURS }

const Ico = ({ d, ...p }) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>
const CartIcon = () => <Ico d={<><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21.5 8H6" /></>} />
const SearchIcon = () => <Ico d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />
const UserIcon = () => <Ico d={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>} />
const SunIcon = () => <Ico d={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>} />
const MoonIcon = () => <Ico d={<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />} />
const Chevron = () => <Ico width="14" height="14" d={<path d="M6 9l6 6 6-6" />} />

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
  const { user, isAdmin, total, count, setOpen, signOut } = useApp()
  const nav = useNavigate()
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const flip = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem('theme', t) } catch {} }
  const [q, setQ] = useState('')
  const [cats, setCats] = useState([])
  const [menu, setMenu] = useState('')
  useEffect(() => {
    supabase.from('products').select('category').eq('in_stock', true).then(({ data }) => setCats([...new Set((data || []).map((p) => p.category))].sort()))
  }, [])
  useEffect(() => {
    const off = (e) => { if (!e.target.closest('.dd')) setMenu('') }
    const esc = (e) => e.key === 'Escape' && setMenu('')
    document.addEventListener('click', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('click', off); document.removeEventListener('keydown', esc) }
  }, [])
  const search = (e) => { e.preventDefault(); nav('/?q=' + encodeURIComponent(q.trim())) }
  const toggle = (m) => setMenu(menu === m ? '' : m)
  return (
    <header className="site">
      <div className="strip">Fresh groceries · Pay on delivery</div>
      <div className="mast wrapx">
        <form className="search" onSubmit={search} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" aria-label="Search products" />
          <button aria-label="Search"><SearchIcon /></button>
        </form>
        <Link to="/" className="logo"><span className="mark"><CartIcon /></span>{SHOP.name}</Link>
        <div className="acts">
          <button className="iconbtn themebtn" onClick={flip} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</button>
          {user ? (
            <div className="dd">
              <button className="iconbtn" onClick={() => toggle('user')} aria-label="Account menu" aria-expanded={menu === 'user'}>
                <span className="avatar">{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" /> : (user.email || '?')[0].toUpperCase()}</span>
              </button>
              {menu === 'user' && <div className="menu right" onClick={() => setMenu('')}>
                <small>{user.email}</small>
                <Link to="/orders">My orders</Link><Link to="/account">Account</Link>{isAdmin && <Link to="/admin">Admin</Link>}
                <button onClick={signOut}>Sign out</button>
              </div>}
            </div>
          ) : <Link className="signin" to="/login"><UserIcon /><span>Sign in</span></Link>}
          <button className="cartbtn" onClick={() => setOpen(true)} aria-label={`Open cart, ${count} items`}>
            <CartIcon /><span className="cnt">{count}</span><span className="amt">{money(total)}</span>
          </button>
        </div>
      </div>
      <nav className="navbar"><div className="wrapx navin">
        <Link to="/">Home</Link>
        <Link to="/#products">All products</Link>
        <div className="dd">
          <button className="navlink" onClick={() => toggle('cats')} aria-expanded={menu === 'cats'}>Categories <Chevron /></button>
          {menu === 'cats' && <div className="menu" onClick={() => setMenu('')}>{cats.map((c) => <Link key={c} to={'/?cat=' + encodeURIComponent(c)}>{c}</Link>)}</div>}
        </div>
        <a href="#contact">Contact</a>
      </div></nav>
    </header>
  )
}

function Tile({ p }) {
  return p.image_url ? <img className="tile" src={p.image_url} alt={p.name} /> : <div className="tile emoji" aria-hidden>{p.emoji}</div>
}

function Qty({ p }) {
  const { cart, add } = useApp()
  const q = cart[p.id]?.qty || 0
  if (!q) return <button className="btn add" onClick={() => add(p)}><CartIcon /> Add</button>
  return <div className="qty"><button onClick={() => add(p, -1)} aria-label="Remove one">−</button><span>{q}</span><button onClick={() => add(p)} aria-label="Add one">+</button></div>
}

function Shop() {
  const [products, setProducts] = useState(null)
  const [err, setErr] = useState('')
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') || ''
  const cat = sp.get('cat') || 'All'
  useEffect(() => {
    supabase.from('products').select('*').eq('in_stock', true).order('category').order('name')
      .then(({ data, error }) => error ? setErr(error.message) : setProducts(data))
  }, [])
  const cats = useMemo(() => ['All', ...new Set((products || []).map((p) => p.category))], [products])
  useEffect(() => { // jump to the products when searching or picking a category
    if ((q || sp.get('cat')) && products) document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
  }, [q, cat, !!products])
  const pick = (c) => { const n = new URLSearchParams(sp); c === 'All' ? n.delete('cat') : n.set('cat', c); setSp(n) }
  const shown = (products || []).filter((p) => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <section className="banner"><div className="wrapx heroin">
        <div>
          <p className="eyebrow">Local · Fresh · Fast</p>
          <h1>Fresh groceries, delivered from the shop down the road.</h1>
          <p>Order online and pay when it arrives at your door.</p>
          <a className="cta" href="#products">Shop now</a>
        </div>
        <div className="floaters" aria-hidden="true"><span>🍅</span><span>🥛</span><span>🍞</span><span>🍌</span><span>🥬</span><span>🍚</span></div>
      </div></section>
      <main id="products" className="wrapx">
        <h2 className="section"><span>{q ? `Results for "${q}"` : cat === 'All' ? 'Fresh picks' : cat}</span></h2>
        <div className="chips">{cats.map((c) => <button key={c} className={c === cat ? 'chip on' : 'chip'} onClick={() => pick(c)}>{c}</button>)}</div>
        {err && <p className="error">Couldn't load products: {err}</p>}
        {!products && !err && <div className="pgrid">{[...Array(8)].map((_, i) => <div key={i} className="pcard skel" />)}</div>}
        {products && !shown.length && <p className="muted center">Nothing matches your search. Try another word or category.</p>}
        <div className="pgrid">
          {shown.map((p) => (
            <article className="pcard" key={p.id}>
              <div className="pimg"><Tile p={p} /><span className="ptag">{p.category}</span></div>
              <div className="pbody">
                <h3>{p.name}</h3><p className="muted">{p.description}</p>
                <div className="pfoot"><b className="price">{money(p.price_cents)}</b><Qty p={p} /></div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
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
  if (ready && !user) return <main className="wrap narrow"><Back /><h1>Sign in to check out</h1><p className="muted">We use your Google account so we can send your confirmation and show your order history.</p><Link className="btn big" to="/login?next=/checkout">Sign in or create account</Link></main>
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
      {ready && !user && <><p className="muted">Sign in to see your orders.</p><Link className="btn" to="/login?next=/orders">Sign in</Link></>}
      {user && !list && <div className="card skel" />}
      {list && !list.length && <><p className="muted">No orders yet. Your first one will show up here.</p><Link className="btn" to="/">Start shopping</Link></>}
      {(list || []).map((o) => { const [t, k] = badge(o); return (
        <Link className="card row" to={'/order/' + o.id} key={o.id}><span>#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString()}<small className={'badge ' + k}>{t}</small></span><b>{money(o.total_cents)}</b></Link>) })}
    </main>
  )
}

function Account() {
  const { user, ready } = useApp()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  if (!ready) return <main className="wrap narrow"><div className="card skel" /></main>
  if (!user) return <main className="wrap narrow"><Back /><h1>Account</h1><Link className="btn" to="/login?next=/account">Sign in</Link></main>
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(''); setOk(false)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg(error.message); else { setOk(true); setPw('') }
  }
  return (
    <main className="wrap narrow"><Back /><h1>Account</h1>
      <p className="muted">Signed in as {user.email}</p>
      <form onSubmit={save}>
        <h2>Set or change your password</h2>
        <p className="muted">Signed in with Google? Add a password so you can also sign in with your email on the mobile app.</p>
        <label>New password<input required type="password" minLength={6} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {msg && <p className="error">{msg}</p>}
        {ok && <p className="muted">Password saved. You can now sign in with your email and this password.</p>}
        <button className="btn big" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </main>
  )
}

function Login() {
  const { user, signIn } = useApp()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/'
  const [mode, setMode] = useState('in')
  const [f, setF] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (user) nav(next, { replace: true }) }, [user])
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('')
    const { data, error } = mode === 'in' ? await supabase.auth.signInWithPassword(f) : await supabase.auth.signUp(f)
    setBusy(false)
    if (error) setMsg(mode === 'in' && /invalid login/i.test(error.message) ? 'Wrong email or password. If you normally sign in with Google, use "Continue with Google" below, then add a password on the Account page.' : error.message)
    else if (mode === 'up' && !data.session) setMsg('Account created. Check your email to confirm it, then sign in.')
  }
  return (
    <main className="wrap narrow"><Back />
      <h1>{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
      <form onSubmit={submit}>
        <label>Email<input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input required type="password" minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {msg && <p className="error">{msg}</p>}
        <button className="btn big" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p className="muted center">{mode === 'in' ? 'New here?' : 'Already have an account?'} <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Create an account' : 'Sign in'}</button></p>
      <GoogleButton big onClick={signIn} label="Continue with Google" />
    </main>
  )
}

function Footer() {
  const has = SHOP.address || SHOP.phone || SHOP.email || SHOP.hours
  return (
    <footer className="foot2" id="contact">
      <div className="wrapx fgrid">
        <div><div className="logo light"><span className="mark"><CartIcon /></span>{SHOP.name}</div><p>Your neighbourhood shop, online. Order what you need and pay on delivery.</p></div>
        <div><h4>Contact</h4>
          {SHOP.address && <p>{SHOP.address}</p>}
          {SHOP.phone && <p>Phone: <a href={'tel:' + SHOP.phone}>{SHOP.phone}</a></p>}
          {SHOP.email && <p><a href={'mailto:' + SHOP.email}>{SHOP.email}</a></p>}
          {SHOP.hours && <p>{SHOP.hours}</p>}
          {!has && <p>Contact details coming soon.</p>}
        </div>
        <div><h4>Quick links</h4><Link to="/">Shop</Link><Link to="/orders">My orders</Link><Link to="/account">Account</Link><Link to="/privacy">Privacy policy</Link></div>
      </div>
      <div className="wrapx fbot"><span>© {new Date().getFullYear()} {SHOP.name}</span><span>Cash on delivery</span></div>
    </footer>
  )
}

export default function App() {
  return <><ScrollToTop /><Header /><Routes><Route path="/" element={<Shop />} /><Route path="/checkout" element={<Checkout />} /><Route path="/order/:id" element={<OrderView />} /><Route path="/orders" element={<Orders />} /><Route path="/admin" element={<Admin />} /><Route path="/login" element={<Login />} /><Route path="/account" element={<Account />} /><Route path="/privacy" element={<Privacy />} /><Route path="*" element={<main className="wrap narrow"><h1>Page not found</h1><Back /></main>} /></Routes><Footer /><CartDrawer /></>
}