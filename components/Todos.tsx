'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Todo = { id: string; text: string; done: boolean; due_date: string | null }

function todayStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Todos() {
  const today = todayStr()
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')
  const [due, setDue] = useState(today)

  useEffect(() => {
    async function load() {
      // open todos due today, overdue, or undated, plus ones finished today
      const { data } = await supabase
        .from('todos')
        .select('id, text, done, due_date')
        .or(`and(done.eq.false,due_date.lte.${today}),and(done.eq.false,due_date.is.null),and(done.eq.true,due_date.eq.${today})`)
        .order('due_date', { nullsFirst: false })
        .order('created_at')
      setTodos(data ?? [])
    }
    load()
  }, [today])

  async function add() {
    const t = text.trim()
    if (!t) return
    const { data } = await supabase
      .from('todos')
      .insert({ text: t, due_date: due || null })
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

  return (
    <section>
      <h2>todos</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="add a todo..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ marginBottom: 0 }}
        />
        <input
          type="date"
          value={due}
          onChange={e => setDue(e.target.value)}
          style={{ background: '#161616', color: '#e6e6e6', border: '1px solid #333', font: 'inherit' }}
        />
        <button onClick={add}>add</button>
      </div>

      {todos.length === 0 && <p style={{ color: '#8a8a8a' }}>nothing to do</p>}

      {todos.map(t => (
        <label key={t.id} style={{ opacity: t.done ? 0.5 : 1 }}>
          <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
          <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
          {t.due_date && t.due_date < today && !t.done && (
            <span style={{ color: '#8a8a8a', fontSize: 12 }}>overdue {t.due_date}</span>
          )}
          <button onClick={() => remove(t.id)}>x</button>
        </label>
      ))}
    </section>
  )
}