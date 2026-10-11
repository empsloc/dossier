'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Habit = { id: string; name: string }

function fmt(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// consecutive done days ending on `from` (or the day before, if `from` isn't done)
function streak(dates: Set<string>, from: string) {
  const d = new Date(from + 'T00:00:00')
  if (!dates.has(fmt(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (dates.has(fmt(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export default function Habits({ date, onChange }: { date: string; onChange: () => void }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<Record<string, Set<string>>>({})

  useEffect(() => {
    async function load() {
      const { data: h } = await supabase
        .from('habits')
        .select('id, name')
        .eq('archived', false)
        .order('sort_order')
      const { data: l } = await supabase
        .from('habit_logs')
        .select('habit_id, log_date')
        .eq('done', true)
      const map: Record<string, Set<string>> = {}
      ;(l ?? []).forEach(r => {
        if (!map[r.habit_id]) map[r.habit_id] = new Set()
        map[r.habit_id].add(r.log_date)
      })
      setHabits(h ?? [])
      setLogs(map)
    }
    load()
  }, [])

  async function toggle(id: string) {
    const wasDone = logs[id]?.has(date) ?? false
    const next = new Set(logs[id] ?? [])
    if (wasDone) next.delete(date)
    else next.add(date)
    setLogs({ ...logs, [id]: next })
    await supabase
      .from('habit_logs')
      .upsert({ habit_id: id, log_date: date, done: !wasDone }, { onConflict: 'habit_id,log_date' })
    onChange()
  }

  return (
    <section>
      <h2>habits — {date}</h2>
      {habits.map(h => {
        const dates = logs[h.id] ?? new Set<string>()
        return (
          <label key={h.id}>
            <input type="checkbox" checked={dates.has(date)} onChange={() => toggle(h.id)} />
            {h.name} — {streak(dates, date)} day streak
          </label>
        )
      })}
    </section>
  )
}