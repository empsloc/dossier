'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type List = { id: string; title: string; note: string; priority: number | null; status: string; sort_order: number }
type Section = { id: string; list_id: string; name: string; kind: string; sort_order: number }
type Item = { id: string; section_id: string; text: string; url: string | null; done: boolean; sort_order: number }

const STATUSES = ['Not started', 'In progress', 'Partially completed', 'Done']
const stars = (n: number | null) => (n ? '★'.repeat(n) : '')
const grey = { color: '#8a8a8a' }

export default function Lists() {
  const [lists, setLists] = useState<List[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newList, setNewList] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [hideFinished, setHideFinished] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: l } = await supabase.from('lists').select('id, title, note, priority, status, sort_order').order('sort_order')
      const { data: s } = await supabase.from('list_sections').select('id, list_id, name, kind, sort_order').order('sort_order')
      const { data: i } = await supabase.from('list_items').select('id, section_id, text, url, done, sort_order').order('sort_order')
      setLists(l ?? [])
      setSections(s ?? [])
      setItems(i ?? [])
    }
    load()
  }, [])

  function toggleOpen(id: string) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---------- lists ----------
  async function addList() {
    const title = newList.trim()
    if (!title) return
    const order = Math.max(0, ...lists.map(l => l.sort_order)) + 1
    const { data } = await supabase
      .from('lists')
      .insert({ title, sort_order: order })
      .select('id, title, note, priority, status, sort_order')
      .single()
    if (data) {
      setLists(prev => [...prev, data])
      setOpen(prev => new Set(prev).add(data.id))
    }
    setNewList('')
  }

  async function updateList(id: string, patch: Partial<List>) {
    setLists(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
    await supabase.from('lists').update(patch).eq('id', id)
  }

  async function removeList(l: List) {
    if (!window.confirm(`Delete "${l.title}" and all its items?`)) return
    const sectionIds = sections.filter(s => s.list_id === l.id).map(s => s.id)
    setLists(prev => prev.filter(x => x.id !== l.id))
    setSections(prev => prev.filter(s => s.list_id !== l.id))
    setItems(prev => prev.filter(i => !sectionIds.includes(i.section_id)))
    await supabase.from('lists').delete().eq('id', l.id)
  }

  // ---------- sections ----------
  async function addSection(listId: string) {
    const name = window.prompt('Section name')?.trim()
    if (!name) return
    const order = Math.max(0, ...sections.filter(s => s.list_id === listId).map(s => s.sort_order)) + 1
    const { data } = await supabase
      .from('list_sections')
      .insert({ list_id: listId, name, sort_order: order })
      .select('id, list_id, name, kind, sort_order')
      .single()
    if (data) setSections(prev => [...prev, data])
  }

  async function renameSection(id: string, name: string) {
    const n = name.trim()
    if (!n) return
    setSections(prev => prev.map(s => (s.id === id ? { ...s, name: n } : s)))
    await supabase.from('list_sections').update({ name: n }).eq('id', id)
  }

  async function removeSection(s: Section) {
    if (!window.confirm(`Delete section "${s.name}" and its items?`)) return
    setSections(prev => prev.filter(x => x.id !== s.id))
    setItems(prev => prev.filter(i => i.section_id !== s.id))
    await supabase.from('list_sections').delete().eq('id', s.id)
  }

  // ---------- items ----------
  async function addItem(sectionId: string) {
    const raw = (drafts[sectionId] ?? '').trim()
    if (!raw) return
    const match = raw.match(/https?:\/\/\S+/)
    const url = match ? match[0] : null
    const text = (url ? raw.replace(url, '').trim() : raw) || url || raw
    const order = Math.max(0, ...items.filter(i => i.section_id === sectionId).map(i => i.sort_order)) + 1
    const { data } = await supabase
      .from('list_items')
      .insert({ section_id: sectionId, text, url, sort_order: order })
      .select('id, section_id, text, url, done, sort_order')
      .single()
    if (data) setItems(prev => [...prev, data])
    setDrafts(prev => ({ ...prev, [sectionId]: '' }))
  }

  async function updateItem(id: string, patch: Partial<Item>) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
    await supabase.from('list_items').update(patch).eq('id', id)
  }

  async function saveText(i: Item, value: string) {
    const t = value.trim()
    if (!t || t === i.text) return
    await updateItem(i.id, { text: t })
  }

  async function editLink(i: Item) {
    const v = window.prompt('Link (leave empty to remove)', i.url ?? '')
    if (v === null) return
    await updateItem(i.id, { url: v.trim() || null })
  }

  async function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('list_items').delete().eq('id', id)
  }

  // ---------- derived ----------
  const q = search.trim().toLowerCase()
  const sectionsOf = (listId: string) => sections.filter(s => s.list_id === listId)
  const itemsOfList = (listId: string) => {
    const ids = new Set(sectionsOf(listId).map(s => s.id))
    return items.filter(i => ids.has(i.section_id))
  }

  const visible = lists.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    const all = itemsOfList(l.id)
    if (hideFinished && all.length > 0 && all.every(i => i.done)) return false
    if (!q) return true
    return l.title.toLowerCase().includes(q) || all.some(i => i.text.toLowerCase().includes(q))
  })

  const box = { background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }
  const row = { display: 'flex', alignItems: 'center', gap: 8 }

  return (
    <section>
      <h2>lists</h2>

      <div style={{ ...row, flexWrap: 'wrap', marginBottom: 10 }}>
        <input type="text" placeholder="search lists and items" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">all statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ ...row, fontSize: 13 }}>
          <input type="checkbox" checked={hideFinished} onChange={e => setHideFinished(e.target.checked)} />
          hide finished
        </label>
      </div>

      <div style={{ ...row, marginBottom: 14 }}>
        <input type="text" placeholder="new list name" value={newList} onChange={e => setNewList(e.target.value)} onKeyDown={e => e.key === 'Enter' && addList()} style={{ marginBottom: 0 }} />
        <button onClick={addList}>add list</button>
      </div>

      {visible.length === 0 && <p style={{ ...grey, fontSize: 13 }}>no lists match</p>}

      {visible.map(l => {
        const all = itemsOfList(l.id)
        const done = all.filter(i => i.done).length
        const isOpen = open.has(l.id) || q !== ''
        const titleMatch = q !== '' && l.title.toLowerCase().includes(q)

        return (
          <div key={l.id} style={box}>
            <div style={{ ...row, justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggleOpen(l.id)}>
              <span>
                {isOpen ? '▾' : '▸'} {l.title}
                {l.priority ? <span style={{ ...grey, marginLeft: 8 }}>{stars(l.priority)}</span> : null}
              </span>
              <span style={{ ...grey, fontSize: 13 }}>
                {l.status} · {done}/{all.length}
              </span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 10 }}>
                <div style={{ ...row, flexWrap: 'wrap', marginBottom: 8, fontSize: 13 }}>
                  <input
                    key={l.id + l.title}
                    type="text"
                    defaultValue={l.title}
                    onBlur={e => e.target.value.trim() && e.target.value.trim() !== l.title && updateList(l.id, { title: e.target.value.trim() })}
                    style={{ marginBottom: 0 }}
                  />
                  <select value={l.priority ?? 0} onChange={e => updateList(l.id, { priority: Number(e.target.value) || null })}>
                    <option value={0}>no priority</option>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{stars(n)}</option>)}
                  </select>
                  <select value={l.status} onChange={e => updateList(l.id, { status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => addSection(l.id)}>+ section</button>
                  <button onClick={() => removeList(l)}>delete list</button>
                </div>

                <input
                  key={l.id + l.note}
                  type="text"
                  placeholder="note"
                  defaultValue={l.note}
                  onBlur={e => e.target.value !== l.note && updateList(l.id, { note: e.target.value })}
                  style={{ width: '100%', marginBottom: 10, fontSize: 13 }}
                />

                {sectionsOf(l.id).length === 0 && <p style={{ ...grey, fontSize: 13 }}>no sections yet, add one</p>}

                {sectionsOf(l.id).map(s => {
                  const shown = items
                    .filter(i => i.section_id === s.id)
                    .filter(i => !q || titleMatch || i.text.toLowerCase().includes(q))
                  return (
                    <div key={s.id} style={{ marginBottom: 12 }}>
                      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 4 }}>
                        <input
                          key={s.id + s.name}
                          type="text"
                          defaultValue={s.name}
                          onBlur={e => e.target.value !== s.name && renameSection(s.id, e.target.value)}
                          style={{ ...grey, marginBottom: 0, background: 'transparent', border: 'none', fontSize: 13 }}
                        />
                        <button onClick={() => removeSection(s)}>x</button>
                      </div>

                      {shown.map(i => (
                        <div key={i.id} style={{ ...row, fontSize: 13, marginBottom: 4, opacity: i.done ? 0.5 : 1 }}>
                          <input type="checkbox" checked={i.done} onChange={() => updateItem(i.id, { done: !i.done })} />
                          <input
                            key={i.id + i.text}
                            type="text"
                            defaultValue={i.text}
                            onBlur={e => saveText(i, e.target.value)}
                            style={{ flex: 1, marginBottom: 0, textDecoration: i.done ? 'line-through' : 'none' }}
                          />
                          {i.url && <a href={i.url} target="_blank" rel="noreferrer" title={i.url}>link</a>}
                          <button onClick={() => editLink(i)} title="edit link">🔗</button>
                          <button onClick={() => removeItem(i.id)}>x</button>
                        </div>
                      ))}

                      <div style={{ ...row, marginTop: 6 }}>
                        <input
                          type="text"
                          placeholder="add item (paste a link to attach it)"
                          value={drafts[s.id] ?? ''}
                          onChange={e => setDrafts(prev => ({ ...prev, [s.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addItem(s.id)}
                          style={{ flex: 1, marginBottom: 0 }}
                        />
                        <button onClick={() => addItem(s.id)}>add</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}