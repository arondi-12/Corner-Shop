import { createClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const money = (c) => 'KES ' + (c / 100).toLocaleString()
const Ctx = createContext()
export const useApp = () => useContext(Ctx)
const readGuest = () => { try { return JSON.parse(localStorage.getItem('cart')) || {} } catch { return {} } }

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(null)
  const [authError, setAuthError] = useState('')
  const [open, setOpen] = useState(false)
  const [cart, setCart] = useState(readGuest) // { productId: { p, qty } }

  useEffect(() => { // show sign-in errors that Supabase puts in the address bar, then clean the URL
    const q = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    const msg = q.get('error_description')
    if (msg) { setAuthError(msg.replace(/\+/g, ' ')); window.history.replaceState(null, '', window.location.pathname) }
  }, [])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setUser(s?.user ?? null)
      if (event === 'SIGNED_OUT') setCart({})
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => setIsAdmin(!!data))
  }, [user?.id])

  // Guests keep their cart in the browser; signed-in users use the database cart.
  useEffect(() => { if (!user) { try { localStorage.setItem('cart', JSON.stringify(cart)) } catch {} } }, [cart, user])
  useEffect(() => { // refresh prices / drop sold-out items in a guest cart
    const ids = Object.keys(cart); if (!ids.length) return
    supabase.from('products').select('*').in('id', ids).eq('in_stock', true).then(({ data }) => {
      if (!data) return
      const fresh = Object.fromEntries(data.map((p) => [p.id, p]))
      setCart((c) => Object.fromEntries(Object.entries(c).filter(([id]) => fresh[id]).map(([id, v]) => [id, { ...v, p: fresh[id] }])))
    })
  }, [])
  useEffect(() => { // signed in: merge guest items, load the cart, then listen for changes from other devices
    if (!user) return
    let live = true
    const load = async () => {
      const { data } = await supabase.from('cart_items').select('qty, product:products(*)')
      if (live && data) setCart(Object.fromEntries(data.filter((r) => r.product?.in_stock).map((r) => [r.product.id, { p: r.product, qty: r.qty }])))
    }
    ;(async () => {
      const guest = Object.values(readGuest())
      if (guest.length) {
        const { data: ex } = await supabase.from('cart_items').select('product_id, qty')
        const have = Object.fromEntries((ex || []).map((r) => [r.product_id, r.qty]))
        await supabase.from('cart_items').upsert(guest.map((i) => ({ user_id: user.id, product_id: i.p.id, qty: (have[i.p.id] || 0) + i.qty })), { onConflict: 'user_id,product_id' })
        try { localStorage.removeItem('cart') } catch {}
      }
      load()
    })()
    const ch = supabase.channel('cart-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items' }, load).subscribe()
    return () => { live = false; supabase.removeChannel(ch) }
  }, [user?.id])

  const add = (p, d = 1) => {
    const q = (cart[p.id]?.qty || 0) + d
    setCart((c) => { const n = { ...c }; if (q <= 0) delete n[p.id]; else n[p.id] = { p, qty: q }; return n })
    if (user) (q <= 0 ? supabase.from('cart_items').delete().eq('product_id', p.id)
      : supabase.from('cart_items').upsert({ user_id: user.id, product_id: p.id, qty: q }, { onConflict: 'user_id,product_id' })).then(() => {})
  }
  const remove = (id) => {
    setCart((c) => { const n = { ...c }; delete n[id]; return n })
    if (user) supabase.from('cart_items').delete().eq('product_id', id).then(() => {})
  }
  const clear = () => { setCart({}); if (user) supabase.from('cart_items').delete().eq('user_id', user.id).then(() => {}) }
  const items = Object.values(cart)
  const total = items.reduce((s, i) => s + i.p.price_cents * i.qty, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } } })
  const signOut = () => supabase.auth.signOut()
  return (
    <Ctx.Provider value={{ user, ready, isAdmin, cart, items, total, count, add, remove, clear, open, setOpen, signIn, signOut }}>
      {authError && <div className="notice" role="alert">Sign-in problem: {authError} <button className="link" onClick={() => setAuthError('')}>Dismiss</button></div>}
      {children}
    </Ctx.Provider>
  )
}