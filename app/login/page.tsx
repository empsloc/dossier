'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('enter your email and password')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(error.message.toLowerCase())
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form
        onSubmit={signIn}
        style={{ width: '100%', maxWidth: 320, background: '#161616', border: '1px solid #333', padding: 20 }}
      >
        <h2 style={{ margin: '0 0 4px' }}>welcome back</h2>
        <p style={{ color: '#8a8a8a', fontSize: 13, margin: '0 0 16px' }}>log in to your tracker</p>

        <input
          type="email"
          autoComplete="email"
          placeholder="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', marginBottom: 14 }}
        />

        <button type="submit" disabled={loading} style={{ width: '100%', padding: '8px 0' }}>
          {loading ? 'logging in…' : 'login'}
        </button>

        {error && <p style={{ color: '#e06666', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
      </form>
    </main>
  )
}