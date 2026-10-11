'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const pad = (n: number) => String(n).padStart(2, '0')

export default function Calendar({
  selected,
  onSelect,
  version,
}: {
  selected: string
  onSelect: (d: string) => void
  version: number
}) {
  const sel = new Date(selected + 'T00:00:00')
  const [year, setYear] = useState(sel.getFullYear())
  const [month, setMonth] = useState(sel.getMonth())
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)

  const label = new Date(year, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // week starts Monday

  useEffect(() => {
    async function load() {
      const start = `${year}-${pad(month + 1)}-01`
      const n = new Date(year, month + 1, 1)
      const end = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-01`
      const { count } = await supabase
        .from('habits')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
      const { data } = await supabase
        .from('habit_logs')
        .select('log_date')
        .eq('done', true)
        .gte('log_date', start)
        .lt('log_date', end)
      const c: Record<string, number> = {}
      ;(data ?? []).forEach(r => { c[r.log_date] = (c[r.log_date] ?? 0) + 1 })
      setCounts(c)
      setTotal(count ?? 0)
    }
    load()
  }, [year, month, version])

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(<div key={'e' + i} />)
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`
    const n = counts[key] ?? 0
    const ratio = total ? n / total : 0
    cells.push(
      <div
        key={key}
        onClick={() => onSelect(key)}
        style={{
          cursor: 'pointer',
          padding: '6px 4px',
          textAlign: 'center',
          fontSize: 13,
          border: key === selected ? '1px solid #e6e6e6' : '1px solid #333',
          background: `rgba(230,230,230,${ratio * 0.7})`,
          color: ratio > 0.5 ? '#0d0d0d' : '#e6e6e6',
        }}
      >
        <div>{day}</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>{n > 0 ? `${n}/${total}` : '·'}</div>
      </div>
    )
  }

  return (
    <section>
      <h2>calendar</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={() => shift(-1)}>&lt;</button>
        <span>{label}</span>
        <button onClick={() => shift(1)}>&gt;</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', color: '#8a8a8a', fontSize: 12 }}>{d}</div>
        ))}
        {cells}
      </div>
    </section>
  )
}