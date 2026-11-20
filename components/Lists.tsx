'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Shimmer from '@/components/Shimmer'

type List = { id: string; title: string; note: string; priority: number | null; status: string; sort_order: number; pinned: boolean }
type Section = { id: string; list_id: string; name: string; kind: string; sort_order: number }
type Item = { id: string; section_id: string; text: string; url: string | null; done: boolean; sort_order: number }

const STATUSES = ['Not started', 'In progress', 'Partially completed', 'Done']
const STATUS_COLOR: Record<string, string> = {
  'Not started': '#8a8a8a',
  'In progress': '#d4a84b',
  'Partially completed': '#6fa3d4',
  'Done': '#5a9e6f',
}
const stars = (n: number | null) => (n ? '★'.repeat(n) : '')

export default function Lists() {
  const [lists, setLists] = useState<List[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newList, setNewList] = useState('')
  const [newSection, setNewSection] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: l } = await supabase.from('lists').select('id, title, note, priority, status, sort_order, pinned').order('sort_order')
      const { data: s } = await supabase.from('list_sections').select('id, list_id, name, kind, sort_order').order('sort_order')
      const { data: i } = await supabase.from('list_items').select('id, section_id, text, url, done, sort_order').order('sort_order')
      setLists(l ?? [])
      setSections(s ?? [])
      setItems(i ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function addList() {
    const title = newList.trim()
    if (!title) return
    const order = Math.max(0, ...lists.map(l => l.sort_order)) + 1
    const { data } = await supabase
      .from('lists')
      .insert({ title, sort_order: order })
      .select('id, title, note, priority, status, sort_order, pinned')
      .single()
    if (data) {
      setLists(prev => [...prev, data])
    }
    setNewList('')
  }

  async function updateList(id: string, patch: Partial<List>) {
    setLists(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
    await supabase.from('lists').update(patch).eq('id', id)
  }

  async function removeList(l: List) {
    const sectionIds = sections.filter(s => s.list_id === l.id).map(s => s.id)
    setLists(prev => prev.filter(x => x.id !== l.id))
    setSections(prev => prev.filter(s => s.list_id !== l.id))
    setItems(prev => prev.filter(i => !sectionIds.includes(i.section_id)))
    await supabase.from('lists').delete().eq('id', l.id)
  }

  async function addSection(listId: string) {
    const name = (newSection[listId] ?? '').trim()
    if (!name) return
    const order = Math.max(0, ...sections.filter(s => s.list_id === listId).map(s => s.sort_order)) + 1
    const { data } = await supabase
      .from('list_sections')
      .insert({ list_id: listId, name, sort_order: order })
      .select('id, list_id, name, kind, sort_order')
      .single()
    if (data) setSections(prev => [...prev, data])
    setNewSection(prev => ({ ...prev, [listId]: '' }))
  }

  async function renameSection(id: string, name: string) {
    const n = name.trim()
    if (!n) return
    setSections(prev => prev.map(s => (s.id === id ? { ...s, name: n } : s)))
    await supabase.from('list_sections').update({ name: n }).eq('id', id)
  }

  async function removeSection(s: Section) {
    setSections(prev => prev.filter(x => x.id !== s.id))
    setItems(prev => prev.filter(i => i.section_id !== s.id))
    await supabase.from('list_sections').delete().eq('id', s.id)
  }

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

  async function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('list_items').delete().eq('id', id)
  }

  const q = search.trim().toLowerCase()
  const sectionsOf = (listId: string) => sections.filter(s => s.list_id === listId)
  const itemsOfList = (listId: string) => {
    const ids = new Set(sectionsOf(listId).map(s => s.id))
    return items.filter(i => ids.has(i.section_id))
  }

  const visible = lists.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (!q) return true
    const all = itemsOfList(l.id)
    return l.title.toLowerCase().includes(q) || all.some(i => i.text.toLowerCase().includes(q))
  })

  const box = { background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 8 }
  const row = { display: 'flex', alignItems: 'center', gap: 8 }

  if (loading) return <section><h2>lists</h2><Shimmer lines={5} /></section>

  return (
    <section>
      <h2>lists</h2>

      <div style={{ ...row, flexWrap: 'wrap', marginBottom: 12 }}>
        <input type="text" placeholder="search" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0, flex: 1 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">all</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ ...row, marginBottom: 16 }}>
        <input type="text" placeholder="new list…" value={newList} onChange={e => setNewList(e.target.value)} onKeyDown={e => e.key === 'Enter' && addList()} style={{ marginBottom: 0 }} />
        <button onClick={addList}>add</button>
      </div>

      {visible.length === 0 && <p style={{ color: '#8a8a8a', fontSize: 13 }}>no lists</p>}

      {visible.map(l => {
        const all = itemsOfList(l.id)
        const done = all.filter(i => i.done).length
        const isCollapsed = collapsed.has(l.id) && q === ''
        const titleMatch = q !== '' && l.title.toLowerCase().includes(q)
        const statusColor = STATUS_COLOR[l.status] ?? '#8a8a8a'

        return (
          <div key={l.id} style={{ ...box, padding: 0, overflow: 'hidden' }}>
            {/* header */}
            <div
              style={{ ...row, justifyContent: 'space-between', padding: '10px 12px', cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid #2a2a2a' }}
              onClick={() => toggleCollapse(l.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#8a8a8a', fontSize: 11 }}>{isCollapsed ? '▸' : '▾'}</span>
                <span style={{ fontWeight: 500 }}>{l.title}</span>
                {l.priority ? <span style={{ color: '#8a8a8a', fontSize: 12 }}>{stars(l.priority)}</span> : null}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ color: statusColor }}>{l.status}</span>
                <span style={{ color: '#8a8a8a' }}>{done}/{all.length}</span>
              </span>
            </div>

            {!isCollapsed && (
              <div style={{ padding: '10px 12px' }}>
                <div style={{ ...row, flexWrap: 'wrap', marginBottom: 8, gap: 6 }}>
                  <input
                    key={l.id + l.title}
                    type="text"
                    defaultValue={l.title}
                    onBlur={e => e.target.value.trim() && e.target.value.trim() !== l.title && updateList(l.id, { title: e.target.value.trim() })}
                    style={{ marginBottom: 0, flex: 1, minWidth: 120 }}
                  />
                  <select value={l.priority ?? 0} onChange={e => updateList(l.id, { priority: Number(e.target.value) || null })}>
                    <option value={0}>no priority</option>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{stars(n)}</option>)}
                  </select>
                  <select value={l.status} onChange={e => updateList(l.id, { status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => updateList(l.id, { pinned: !l.pinned })} style={{ color: l.pinned ? '#d4a84b' : '#8a8a8a' }}>{l.pinned ? 'pinned' : 'pin'}</button>
                  <button onClick={() => removeList(l)} style={{ color: '#8a8a8a' }}>delete</button>
                </div>

                <input
                  key={l.id + l.note}
                  type="text"
                  placeholder="note…"
                  defaultValue={l.note}
                  onBlur={e => e.target.value !== l.note && updateList(l.id, { note: e.target.value })}
                  style={{ width: '100%', marginBottom: 12, fontSize: 13, color: '#8a8a8a' }}
                />

                {sectionsOf(l.id).map(s => {
                  const shown = items
                    .filter(i => i.section_id === s.id)
                    .filter(i => !q || titleMatch || i.text.toLowerCase().includes(q))
                  const doneCount = shown.filter(i => i.done).length
                  return (
                    <div key={s.id} style={{ marginBottom: 14 }}>
                      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 6, borderBottom: '1px solid #2a2a2a', paddingBottom: 4 }}>
                        <input
                          key={s.id + s.name}
                          type="text"
                          defaultValue={s.name}
                          onBlur={e => e.target.value !== s.name && renameSection(s.id, e.target.value)}
                          style={{ color: '#8a8a8a', marginBottom: 0, background: 'transparent', border: 'none', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                        />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8a8a8a', fontSize: 12 }}>
                          {doneCount}/{shown.length}
                          <button onClick={() => removeSection(s)} style={{ fontSize: 11, padding: '2px 6px' }}>x</button>
                        </span>
                      </div>

                      {shown.map(i => (
                        <div key={i.id} style={{ ...row, fontSize: 13, marginBottom: 3, opacity: i.done ? 0.45 : 1 }}>
                          <input type="checkbox" checked={i.done} onChange={() => updateItem(i.id, { done: !i.done })} />
                          <input
                            key={i.id + i.text}
                            type="text"
                            defaultValue={i.text}
                            onBlur={e => saveText(i, e.target.value)}
                            style={{ flex: 1, marginBottom: 0, textDecoration: i.done ? 'line-through' : 'none', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2a2a' }}
                          />
                          {i.url && <a href={i.url} target="_blank" rel="noreferrer" style={{ color: '#8a8a8a', fontSize: 12 }}>url</a>}
                          <button onClick={() => removeItem(i.id)} style={{ fontSize: 11, padding: '2px 6px', color: '#8a8a8a' }}>x</button>
                        </div>
                      ))}

                      <div style={{ ...row, marginTop: 6 }}>
                        <input
                          type="text"
                          placeholder="add item…"
                          value={drafts[s.id] ?? ''}
                          onChange={e => setDrafts(prev => ({ ...prev, [s.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addItem(s.id)}
                          style={{ flex: 1, marginBottom: 0, fontSize: 13 }}
                        />
                        <button onClick={() => addItem(s.id)}>add</button>
                      </div>
                    </div>
                  )
                })}

                {/* add section */}
                <div style={{ ...row, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="new section…"
                    value={newSection[l.id] ?? ''}
                    onChange={e => setNewSection(prev => ({ ...prev, [l.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSection(l.id)}
                    style={{ flex: 1, marginBottom: 0, fontSize: 13, color: '#8a8a8a' }}
                  />
                  <button onClick={() => addSection(l.id)}>+ section</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
