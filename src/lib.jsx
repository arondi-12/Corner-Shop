import { createClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const money = (c) => 'KES ' + (c / 100).toLocaleString()
const Ctx = createContext()
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('cart')) || {} } catch { return {} } })
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => { try { localStorage.setItem('cart', JSON.stringify(cart)) } catch {} }, [cart])
  const add = (p, d = 1) => setCart((c) => {
    const q = (c[p.id]?.qty || 0) + d, n = { ...c }
    if (q <= 0) delete n[p.id]; else n[p.id] = { p, qty: q }
    return n
  })
  const remove = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n })
  const items = Object.values(cart)
  const total = items.reduce((s, i) => s + i.p.price_cents * i.qty, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })
  const signOut = () => supabase.auth.signOut()
  return <Ctx.Provider value={{ user, ready, cart, items, total, count, add, remove, clear: () => setCart({}), open, setOpen, signIn, signOut }}>{children}</Ctx.Provider>
}