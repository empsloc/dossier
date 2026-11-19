'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Shimmer from '@/components/Shimmer'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

type Entry = { entry_date: string; body: string }

export default function Journal() {
  const todayKey = fmt(new Date())
  const [date, setDate] = useState(todayKey)
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase
      .from('journal_entries')
      .select('entry_date, body')
      .order('entry_date', { ascending: false })
      .limit(30)
      .then(({ data }) => { setEntries((data ?? []) as Entry[]); setLoading(false) })
  }, [])

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
      if (!error) {
        setStatus('saved')
        setEntries(prev => {
          const without = prev.filter(e => e.entry_date !== day)
          return [{ entry_date: day, body: value }, ...without].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
        })
      } else {
        setStatus('save failed')
      }
    }, 700)
  }

  if (loading) return <section><h2>journal</h2><Shimmer lines={4} /></section>

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

      {entries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowList(v => !v)}
            style={{ color: '#8a8a8a', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', padding: 0 }}
          >
            {showList ? '▾' : '▸'} previous entries ({entries.length})
          </button>
          {showList && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {entries.map(e => (
                <div
                  key={e.entry_date}
                  onClick={() => setDate(e.entry_date)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    background: e.entry_date === date ? '#1e1e1e' : 'transparent',
                    border: e.entry_date === date ? '1px solid #444' : '1px solid transparent',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: '#8a8a8a', whiteSpace: 'nowrap' }}>
                    {new Date(e.entry_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.body.split('\n')[0].slice(0, 80) || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}