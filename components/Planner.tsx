'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Shimmer from '@/components/Shimmer'

type Todo = { id: string; text: string; done: boolean; due_date: string }
type PinnedList = { id: string; title: string; sections: { id: string; name: string; items: { id: string; text: string; done: boolean }[] }[] }

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function Planner() {
  const now = new Date()
  const todayKey = fmt(now)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(todayKey)
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [pinnedLists, setPinnedLists] = useState<PinnedList[]>([])

  const label = new Date(year, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // week starts Monday

  useEffect(() => {
    async function load() {
      const start = `${year}-${pad(month + 1)}-01`
      const n = new Date(year, month + 1, 1)
      const end = fmt(n)
      const { data } = await supabase
        .from('todos')
        .select('id, text, done, due_date')
        .gte('due_date', start)
        .lt('due_date', end)
        .order('created_at')
      setTodos(data ?? [])
      setLoading(false)
    }
    load()
  }, [year, month])

  useEffect(() => {
    async function loadPinned() {
      const { data: lists } = await supabase.from('lists').select('id, title').eq('pinned', true).order('sort_order')
      if (!lists?.length) return
      const listIds = lists.map(l => l.id)
      const { data: secs } = await supabase.from('list_sections').select('id, list_id, name').order('sort_order')
      const secIds = (secs ?? []).filter(s => listIds.includes(s.list_id)).map(s => s.id)
      const { data: its } = await supabase.from('list_items').select('id, section_id, text, done').order('sort_order')
      const relevantSecs = (secs ?? []).filter(s => listIds.includes(s.list_id))
      const relevantItems = (its ?? []).filter(i => secIds.includes(i.section_id))
      setPinnedLists(lists.map(l => ({
        ...l,
        sections: relevantSecs
          .filter(s => s.list_id === l.id)
          .map(s => ({
            ...s,
            items: relevantItems.filter(i => i.section_id === s.id),
          })),
      })))
    }
    loadPinned()
  }, [])

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    const isNow = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    setSelected(isNow ? todayKey : fmt(d))
  }

  async function add() {
    const t = text.trim()
    if (!t) return
    const { data } = await supabase
      .from('todos')
      .insert({ text: t, due_date: selected })
      .select('id, text, done, due_date')
      .single()
    if (data) setTodos([...todos, data])
    setText('')
  }

  async function toggle(todo: Todo) {
    setTodos(todos.map(t => (t.id === todo.id ? { ...t, done: !t.done } : t)))
    await supabase.from('todos').update({ done: !todo.done }).eq('id', todo.id)
  }

  async function remove(id: string) {
    setTodos(todos.filter(t => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const stats: Record<string, { done: number; total: number }> = {}
  todos.forEach(t => {
    const s = (stats[t.due_date] ??= { done: 0, total: 0 })
    s.total++
    if (t.done) s.done++
  })

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(<div key={'e' + i} />)
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`
    const s = stats[key]
    cells.push(
      <div
        key={key}
        onClick={() => setSelected(key)}
        style={{
          cursor: 'pointer',
          padding: '6px 4px',
          textAlign: 'center',
          fontSize: 13,
          border: key === selected ? '1px solid #e6e6e6' : '1px solid #333',
          background: key === todayKey ? '#161616' : 'transparent',
        }}
      >
        <div>{day}</div>
        <div style={{ fontSize: 11, color: '#8a8a8a' }}>{s ? `${s.done}/${s.total}` : '·'}</div>
      </div>
    )
  }

  const dayTodos = todos.filter(t => t.due_date === selected)

  if (loading) return <section><h2>planner</h2><Shimmer lines={5} /></section>

  return (
    <section>
      <h2>planner</h2>
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

      <h2>{selected}</h2>
      <input
        type="text"
        placeholder="add a todo for this day..."
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && add()}
      />

      {dayTodos.length === 0 && <p style={{ color: '#8a8a8a' }}>nothing planned</p>}

      {dayTodos.map(t => (
        <label key={t.id} style={{ opacity: t.done ? 0.5 : 1 }}>
          <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
          <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
          <button onClick={() => remove(t.id)}>x</button>
        </label>
      ))}

      {pinnedLists.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>always visible</h2>
          {pinnedLists.map(l => (
            <div key={l.id} style={{ background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }}>
              <div style={{ color: '#e6e6e6', marginBottom: 8, fontWeight: 500 }}>{l.title}</div>
              {l.sections.map(s => (
                <div key={s.id} style={{ marginBottom: 10 }}>
                  {s.name && <div style={{ color: '#8a8a8a', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.name}</div>}
                  {s.items.map(i => (
                    <label key={i.id} style={{ opacity: i.done ? 0.45 : 1 }}>
                      <input
                        type="checkbox"
                        checked={i.done}
                        onChange={async () => {
                          const next = !i.done
                          setPinnedLists(prev => prev.map(pl => pl.id === l.id ? {
                            ...pl,
                            sections: pl.sections.map(ps => ps.id === s.id ? {
                              ...ps,
                              items: ps.items.map(pi => pi.id === i.id ? { ...pi, done: next } : pi),
                            } : ps),
                          } : pl))
                          await supabase.from('list_items').update({ done: next }).eq('id', i.id)
                        }}
                      />
                      <span style={{ textDecoration: i.done ? 'line-through' : 'none' }}>{i.text}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </section>
  )
}