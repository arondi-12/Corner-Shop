import { Link } from 'react-router-dom'

const contact = import.meta.env.VITE_CONTACT_EMAIL || 'the shop owner through the details on this site'

export default function Privacy() {
  return (
    <main className="wrap narrow legal">
      <Link className="back" to="/">← Back to shop</Link>
      <h1>Privacy policy</h1>
      <p className="muted">Last updated: October 2026. This shop is a student project built for learning, so no real goods are sold through it.</p>
      <h2>What we collect</h2>
      <p>When you sign in with Google we receive your name, email address and profile photo. When you place an order we store your phone number, delivery address, any note you add, and the items you ordered.</p>
      <h2>Why we use it</h2>
      <p>Only to sign you in, process and deliver your orders, show you your order history, and send you an order confirmation email. We do not sell your data or use it for advertising.</p>
      <h2>Who processes it</h2>
      <p>The app uses Supabase (database and sign-in), Vercel (hosting), Mailgun (confirmation emails) and Google (sign-in). They handle data only to provide those services.</p>
      <h2>How long we keep it</h2>
      <p>Order records are kept while the shop operates. You can ask for your data to be deleted at any time.</p>
      <h2>Your rights</h2>
      <p>You can ask to see, correct or delete your data by contacting {contact}.</p>
    </main>
  )
}