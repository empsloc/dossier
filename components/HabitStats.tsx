'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Habit = { id: string; name: string }

const pad = (n: number) => String(n).padStart(2, '0')

export default function HabitStats() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11
  const [habits, setHabits] = useState<Habit[]>([])
  const [done, setDone] = useState<Set<string>>(new Set()) // "habitId|YYYY-MM-DD"

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const label = new Date(year, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' })
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  useEffect(() => {
    async function load() {
      const start = `${year}-${pad(month + 1)}-01`
      const n = new Date(year, month + 1, 1)
      const end = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-01`

      const { data: h } = await supabase
        .from('habits')
        .select('id, name')
        .eq('archived', false)
        .order('sort_order')
      const { data: l } = await supabase
        .from('habit_logs')
        .select('habit_id, log_date')
        .eq('done', true)
        .gte('log_date', start)
        .lt('log_date', end)

      setHabits(h ?? [])
      setDone(new Set((l ?? []).map(r => `${r.habit_id}|${r.log_date}`)))
    }
    load()
  }, [year, month])

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <section>
      <h2>monthly breakdown</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={() => shift(-1)}>&lt;</button>
        <span>{label}</span>
        <button onClick={() => shift(1)}>&gt;</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingRight: 10, fontWeight: 'normal', color: '#8a8a8a' }}></th>
              {days.map(d => (
                <th key={d} style={{ width: 16, fontWeight: 'normal', color: '#8a8a8a' }}>{d}</th>
              ))}
              <th style={{ paddingLeft: 10, fontWeight: 'normal', color: '#8a8a8a' }}>total</th>
            </tr>
          </thead>
          <tbody>
            {habits.map(h => {
              let total = 0
              return (
                <tr key={h.id}>
                  <td style={{ paddingRight: 10, whiteSpace: 'nowrap', fontSize: 13 }}>{h.name}</td>
                  {days.map(d => {
                    const key = `${year}-${pad(month + 1)}-${pad(d)}`
                    const isDone = done.has(`${h.id}|${key}`)
                    if (isDone) total++
                    return (
                      <td key={d} style={{ padding: 1 }}>
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            background: isDone ? '#e6e6e6' : 'transparent',
                            border: key === todayKey ? '1px solid #e6e6e6' : '1px solid #333',
                          }}
                        />
                      </td>
                    )
                  })}
                  <td style={{ paddingLeft: 10, fontSize: 13 }}>{total}/{daysInMonth}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}