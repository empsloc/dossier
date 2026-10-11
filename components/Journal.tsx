'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function Journal() {
  const todayKey = fmt(new Date())
  const [date, setDate] = useState(todayKey)
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setBody('')
    setStatus('')
    supabase
      .from('journal_entries')
      .select('body')
      .eq('entry_date', date)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setBody(data?.body ?? '')
      })
    return () => { cancelled = true }
  }, [date])

  function shift(delta: number) {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(fmt(d))
  }

  function onType(value: string) {
    const day = date
    setBody(value)
    setStatus('typing...')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('journal_entries')
        .upsert(
          { entry_date: day, body: value, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,entry_date' }
        )
      setStatus(error ? 'save failed' : 'saved')
    }, 700)
  }

  return (
    <section>
      <h2>journal</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => shift(-1)}>&lt;</button>
        <input
          type="date"
          value={date}
          onChange={e => e.target.value && setDate(e.target.value)}
          style={{ background: '#161616', color: '#e6e6e6', border: '1px solid #333', font: 'inherit', padding: '6px 8px' }}
        />
        <button onClick={() => shift(1)}>&gt;</button>
        <button onClick={() => setDate(todayKey)}>today</button>
        <span style={{ color: '#8a8a8a', fontSize: 13 }}>{status}</span>
      </div>
      <textarea
        value={body}
        onChange={e => onType(e.target.value)}
        placeholder="write..."
        style={{
          width: '100%',
          minHeight: 240,
          background: '#161616',
          color: '#e6e6e6',
          border: '1px solid #333',
          padding: 12,
          font: 'inherit',
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
        }}
      />
    </section>
  )
}