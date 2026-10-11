'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Project = { id: string; title: string; description: string }
type Todo = { id: string; project_id: string; text: string; done: boolean }

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('projects').select('id, title, description').order('created_at')
      const { data: t } = await supabase.from('project_todos').select('id, project_id, text, done').order('created_at')
      setProjects(p ?? [])
      setTodos(t ?? [])
    }
    load()
  }, [])

  function toggleOpen(id: string) {
    setOpen(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function addProject() {
    const t = title.trim()
    if (!t) return
    const { data } = await supabase.from('projects').insert({ title: t }).select('id, title, description').single()
    if (data) {
      setProjects(prev => [...prev, data])
      setOpen(prev => new Set(prev).add(data.id))
    }
    setTitle('')
  }

  async function updateProject(id: string, patch: Partial<Project>) {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
    await supabase.from('projects').update(patch).eq('id', id)
  }

  async function removeProject(p: Project) {
    if (!window.confirm(`Delete "${p.title}" and its todos?`)) return
    setProjects(prev => prev.filter(x => x.id !== p.id))
    setTodos(prev => prev.filter(t => t.project_id !== p.id))
    await supabase.from('projects').delete().eq('id', p.id)
  }

  async function addTodo(projectId: string) {
    const text = (drafts[projectId] ?? '').trim()
    if (!text) return
    const { data } = await supabase
      .from('project_todos')
      .insert({ project_id: projectId, text })
      .select('id, project_id, text, done')
      .single()
    if (data) setTodos(prev => [...prev, data])
    setDrafts(prev => ({ ...prev, [projectId]: '' }))
  }

  async function updateTodo(id: string, patch: Partial<Todo>) {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
    await supabase.from('project_todos').update(patch).eq('id', id)
  }

  async function removeTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('project_todos').delete().eq('id', id)
  }

  const box = { background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }
  const row = { display: 'flex', alignItems: 'center', gap: 8 }
  const grey = { color: '#8a8a8a' }

  return (
    <section>
      <h2>projects</h2>

      <div style={{ ...row, marginBottom: 14 }}>
        <input type="text" placeholder="new project title" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} style={{ marginBottom: 0 }} />
        <button onClick={addProject}>add project</button>
      </div>

      {projects.length === 0 && <p style={{ ...grey, fontSize: 13 }}>no projects yet</p>}

      {projects.map(p => {
        const mine = todos.filter(t => t.project_id === p.id)
        const done = mine.filter(t => t.done).length
        const isOpen = open.has(p.id)
        return (
          <div key={p.id} style={box}>
            <div style={{ ...row, justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggleOpen(p.id)}>
              <span>{isOpen ? '▾' : '▸'} {p.title}</span>
              <span style={{ ...grey, fontSize: 13 }}>{done}/{mine.length}</span>
            </div>

            {!isOpen && p.description && (
              <p style={{ ...grey, fontSize: 13, margin: '6px 0 0' }}>{p.description.slice(0, 120)}{p.description.length > 120 ? '…' : ''}</p>
            )}

            {isOpen && (
              <div style={{ marginTop: 10 }}>
                <div style={{ ...row, marginBottom: 8 }}>
                  <input
                    key={p.id + p.title}
                    type="text"
                    defaultValue={p.title}
                    onBlur={e => e.target.value.trim() && e.target.value.trim() !== p.title && updateProject(p.id, { title: e.target.value.trim() })}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <button onClick={() => removeProject(p)}>delete</button>
                </div>

                <textarea
                  key={p.id + p.description}
                  placeholder="description"
                  defaultValue={p.description}
                  onBlur={e => e.target.value !== p.description && updateProject(p.id, { description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', marginBottom: 10, fontSize: 13 }}
                />

                <div style={{ ...grey, fontSize: 13, marginBottom: 4 }}>what needs to be done</div>
                {mine.map(t => (
                  <div key={t.id} style={{ ...row, fontSize: 13, marginBottom: 4, opacity: t.done ? 0.5 : 1 }}>
                    <input type="checkbox" checked={t.done} onChange={() => updateTodo(t.id, { done: !t.done })} />
                    <input
                      key={t.id + t.text}
                      type="text"
                      defaultValue={t.text}
                      onBlur={e => e.target.value.trim() && e.target.value.trim() !== t.text && updateTodo(t.id, { text: e.target.value.trim() })}
                      style={{ flex: 1, marginBottom: 0, textDecoration: t.done ? 'line-through' : 'none' }}
                    />
                    <button onClick={() => removeTodo(t.id)}>x</button>
                  </div>
                ))}

                <div style={{ ...row, marginTop: 6 }}>
                  <input
                    type="text"
                    placeholder="add a todo"
                    value={drafts[p.id] ?? ''}
                    onChange={e => setDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTodo(p.id)}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <button onClick={() => addTodo(p.id)}>add</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}