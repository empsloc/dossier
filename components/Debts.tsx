'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Debt = { id: string; person: string; note: string; amount: number; settled: boolean }

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

export default function Debts({ direction }: { direction: 'i_owe' | 'owed_to_me' }) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [person, setPerson] = useState('')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')

  const title = direction === 'i_owe' ? 'I owe' : 'owed to me'

  useEffect(() => {
    supabase
      .from('debts')
      .select('id, person, note, amount, settled')
      .eq('direction', direction)
      .order('created_at')
      .then(({ data }) =>
        setDebts((data ?? []).map(d => ({ ...d, amount: Number(d.amount) })))
      )
  }, [direction])

  async function add() {
    const n = Number(amount)
    if (!person.trim() || !amount.trim() || Number.isNaN(n)) return
    const { data } = await supabase
      .from('debts')
      .insert({ person: person.trim(), note: note.trim(), amount: n, direction })
      .select('id, person, note, amount, settled')
      .single()
    if (data) setDebts([...debts, { ...data, amount: Number(data.amount) }])
    setNote('')
    setAmount('')
  }

  async function toggle(d: Debt) {
    setDebts(debts.map(x => (x.id === d.id ? { ...x, settled: !x.settled } : x)))
    await supabase.from('debts').update({ settled: !d.settled }).eq('id', d.id)
  }

  async function saveAmount(d: Debt, value: string) {
    const n = Number(value)
    if (value.trim() === '' || Number.isNaN(n)) return
    setDebts(debts.map(x => (x.id === d.id ? { ...x, amount: n } : x)))
    await supabase.from('debts').update({ amount: n }).eq('id', d.id)
  }

  async function remove(id: string) {
    setDebts(debts.filter(d => d.id !== id))
    await supabase.from('debts').delete().eq('id', id)
  }

  const people = Array.from(new Set(debts.map(d => d.person)))
  const total = debts.filter(d => !d.settled).reduce((s, d) => s + d.amount, 0)

  return (
    <section>
      <h2>{title} — {money(total)}</h2>

      {people.map(p => {
        const mine = debts.filter(d => d.person === p)
        const sub = mine.filter(d => !d.settled).reduce((s, d) => s + d.amount, 0)
        return (
          <div key={p} style={{ background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{p}</span><span>{money(sub)}</span>
            </div>
            {mine.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: d.settled ? 0.5 : 1 }}>
                <input type="checkbox" checked={d.settled} onChange={() => toggle(d)} />
                <span style={{ flex: 1, textDecoration: d.settled ? 'line-through' : 'none' }}>{d.note || '—'}</span>
                <span>₹</span>
                <input
                  key={d.id + d.amount}
                  type="text"
                  defaultValue={d.amount}
                  onBlur={e => saveAmount(d, e.target.value)}
                  style={{ width: 80, marginBottom: 0, textAlign: 'right' }}
                />
                <button onClick={() => remove(d.id)}>x</button>
              </div>
            ))}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8 }}>
        <input type="text" placeholder="person" value={person} onChange={e => setPerson(e.target.value)} style={{ marginBottom: 0 }} />
        <input type="text" placeholder="what for" value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: 0 }} />
        <input type="text" placeholder="amount" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} style={{ marginBottom: 0 }} />
        <button onClick={add}>add</button>
      </div>
    </section>
  )
}