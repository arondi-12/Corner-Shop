import { createClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const money = (c) => 'KES ' + (c / 100).toLocaleString()
const Ctx = createContext()
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(null)
  const [authError, setAuthError] = useState('')
  useEffect(() => { // show sign-in errors that Supabase puts in the address bar, then clean the URL
    const q = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    const msg = q.get('error_description')
    if (msg) { setAuthError(msg.replace(/\+/g, ' ')); window.history.replaceState(null, '', window.location.pathname) }
  }, [])
  const [open, setOpen] = useState(false)
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('cart')) || {} } catch { return {} } })
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => setIsAdmin(!!data))
  }, [user])
  useEffect(() => { try { localStorage.setItem('cart', JSON.stringify(cart)) } catch {} }, [cart])
  useEffect(() => { // drop sold-out items and refresh prices saved from an earlier visit
    const ids = Object.keys(cart); if (!ids.length) return
    supabase.from('products').select('*').in('id', ids).eq('in_stock', true).then(({ data }) => {
      if (!data) return
      const fresh = Object.fromEntries(data.map((p) => [p.id, p]))
      setCart((c) => Object.fromEntries(Object.entries(c).filter(([id]) => fresh[id]).map(([id, v]) => [id, { ...v, p: fresh[id] }])))
    })
  }, [])
  const add = (p, d = 1) => setCart((c) => {
    const q = (c[p.id]?.qty || 0) + d, n = { ...c }
    if (q <= 0) delete n[p.id]; else n[p.id] = { p, qty: q }
    return n
  })
  const remove = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n })
  const items = Object.values(cart)
  const total = items.reduce((s, i) => s + i.p.price_cents * i.qty, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } } })
  const signOut = () => supabase.auth.signOut()
  return <Ctx.Provider value={{ user, ready, isAdmin, cart, items, total, count, add, remove, clear: () => setCart({}), open, setOpen, signIn, signOut }}>
    {authError && <div className="notice" role="alert">Sign-in problem: {authError} <button className="link" onClick={() => setAuthError('')}>Dismiss</button></div>}
    {children}
  </Ctx.Provider>
}