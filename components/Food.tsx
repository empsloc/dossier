'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Entry = { id: string; meal: string; name: string; calories: number }

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (day: string, delta: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return fmt(new Date(y, m - 1, d + delta))
}

export default function Food() {
  const [day, setDay] = useState(fmt(new Date()))
  const [entries, setEntries] = useState<Entry[]>([])
  const [goal, setGoal] = useState(2000)
  const [known, setKnown] = useState<Record<string, number>>({})
  const [meal, setMeal] = useState('breakfast')
  const [name, setName] = useState('')
  const [cal, setCal] = useState('')

  useEffect(() => {
    async function loadOnce() {
      const { data: s } = await supabase.from('food_settings').select('daily_goal').maybeSingle()
      if (s) setGoal(s.daily_goal)
      const { data: r } = await supabase
        .from('food_entries')
        .select('name, calories')
        .order('created_at', { ascending: false })
        .limit(300)
      const map: Record<string, number> = {}
      ;(r ?? []).forEach(x => {
        const k = x.name.toLowerCase()
        if (!(k in map)) map[k] = x.calories
      })
      setKnown(map)
    }
    loadOnce()
  }, [])

  useEffect(() => {
    supabase
      .from('food_entries')
      .select('id, meal, name, calories')
      .eq('eaten_on', day)
      .order('created_at')
      .then(({ data }) => setEntries(data ?? []))
  }, [day])

  async function saveGoal(value: string) {
    const n = Math.round(Number(value))
    if (!n || n <= 0 || n === goal) return
    setGoal(n)
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user.id
    if (uid) await supabase.from('food_settings').upsert({ user_id: uid, daily_goal: n })
  }

  function onNameChange(v: string) {
    setName(v)
    const hit = known[v.trim().toLowerCase()]
    if (hit !== undefined && cal === '') setCal(String(hit))
  }

  async function add() {
    const n = Math.round(Number(cal))
    if (!name.trim() || !cal.trim() || Number.isNaN(n)) return
    const { data } = await supabase
      .from('food_entries')
      .insert({ eaten_on: day, meal, name: name.trim(), calories: n })
      .select('id, meal, name, calories')
      .single()
    if (data) {
      setEntries(prev => [...prev, data])
      setKnown(prev => ({ ...prev, [data.name.toLowerCase()]: data.calories }))
    }
    setName('')
    setCal('')
  }

  async function update(id: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
    await supabase.from('food_entries').update(patch).eq('id', id)
  }

  async function remove(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
    await supabase.from('food_entries').delete().eq('id', id)
  }

  const total = entries.reduce((s, e) => s + e.calories, 0)
  const left = goal - total
  const pct = Math.min(100, Math.round((total / goal) * 100))
  const isToday = day === fmt(new Date())

  const box = { background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }
  const row = { display: 'flex', alignItems: 'center', gap: 8 }
  const grey = { color: '#8a8a8a' }

  return (
    <section>
      <h2>food</h2>

      <div style={{ ...row, marginBottom: 10 }}>
        <button onClick={() => setDay(shift(day, -1))}>←</button>
        <span>{isToday ? 'today' : day}</span>
        <button onClick={() => setDay(shift(day, 1))}>→</button>
        {!isToday && <button onClick={() => setDay(fmt(new Date()))}>today</button>}
      </div>

      <div style={box}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <span>eaten</span><span>{total} kcal</span>
        </div>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <span>goal</span>
          <span style={row}>
            <input
              key={goal}
              type="text"
              defaultValue={goal}
              onBlur={e => saveGoal(e.target.value)}
              style={{ width: 70, marginBottom: 0, textAlign: 'right' }}
            />
            kcal
          </span>
        </div>
        <div style={{ ...row, justifyContent: 'space-between', color: left < 0 ? '#e06666' : '#8a8a8a' }}>
          <span>{left >= 0 ? 'left' : 'over by'}</span><span>{Math.abs(left)} kcal</span>
        </div>
        <div style={{ background: '#333', height: 6, marginTop: 8 }}>
          <div style={{ width: `${pct}%`, height: 6, background: left < 0 ? '#e06666' : '#6aa84f' }} />
        </div>
      </div>

      <div style={{ ...row, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={meal} onChange={e => setMeal(e.target.value)}>
          {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" list="known-foods" placeholder="what did you eat" value={name} onChange={e => onNameChange(e.target.value)} style={{ marginBottom: 0 }} />
        <datalist id="known-foods">
          {Object.keys(known).map(k => <option key={k} value={k} />)}
        </datalist>
        <input type="text" placeholder="kcal" value={cal} onChange={e => setCal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} style={{ width: 80, marginBottom: 0 }} />
        <button onClick={add}>add</button>
      </div>

      {entries.length === 0 && <p style={{ ...grey, fontSize: 13 }}>nothing logged for this day</p>}

      {MEALS.map(m => {
        const mine = entries.filter(e => e.meal === m)
        if (mine.length === 0) return null
        const sub = mine.reduce((s, e) => s + e.calories, 0)
        return (
          <div key={m} style={box}>
            <div style={{ ...row, justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{m}</span><span style={grey}>{sub} kcal</span>
            </div>
            {mine.map(e => (
              <div key={e.id} style={{ ...row, fontSize: 13, marginBottom: 4 }}>
                <input
                  key={e.id + e.name}
                  type="text"
                  defaultValue={e.name}
                  onBlur={ev => ev.target.value.trim() && ev.target.value.trim() !== e.name && update(e.id, { name: ev.target.value.trim() })}
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <input
                  key={e.id + e.calories}
                  type="text"
                  defaultValue={e.calories}
                  onBlur={ev => {
                    const n = Math.round(Number(ev.target.value))
                    if (!Number.isNaN(n) && ev.target.value.trim() !== '' && n !== e.calories) update(e.id, { calories: n })
                  }}
                  style={{ width: 70, marginBottom: 0, textAlign: 'right' }}
                />
                <button onClick={() => remove(e.id)}>x</button>
              </div>
            ))}
          </div>
        )
      })}
    </section>
  )
}