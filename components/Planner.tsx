'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Todo = { id: string; text: string; done: boolean; due_date: string }

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
    }
    load()
  }, [year, month])

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
    </section>
  )
}