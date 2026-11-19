'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Data = {
  income: number
  plannedSpend: number
  plannedSave: number
  spent: number
  accounts: { name: string; balance: number }[]
  owedToMe: number
  iOwe: number
}
type Snap = { id: string; label: string; remark: string; data: Data }

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function Snapshots({ data, month }: { data: Data; month: string }) {
  const [snaps, setSnaps] = useState<Snap[]>([])
  const [label, setLabel] = useState(monthLabel(month))
  const [remark, setRemark] = useState('')

  useEffect(() => {
    setLabel(monthLabel(month))
    setRemark('')
  }, [month])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('finance_snapshots')
      .select('id, label, remark, data')
      .order('created_at', { ascending: false })
      .then(({ data: d }) => setSnaps((d as Snap[]) ?? []))
  }, [])

  async function save() {
    if (!label.trim()) return
    const { data: row } = await supabase
      .from('finance_snapshots')
      .insert({ label: label.trim(), remark: remark.trim(), data })
      .select('id, label, remark, data')
      .single()
    if (row) setSnaps(prev => [row as Snap, ...prev])
    setRemark('')
  }

  async function remove(s: Snap) {
    if (!window.confirm(`Delete snapshot "${s.label}"?`)) return
    setSnaps(prev => prev.filter(x => x.id !== s.id))
    await supabase.from('finance_snapshots').delete().eq('id', s.id)
  }

  const box = { background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }
  const row = { display: 'flex', justifyContent: 'space-between' }
  const grey = { color: '#8a8a8a' }

  return (
    <div>
      <h3>snapshots</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input type="text" placeholder="label" value={label} onChange={e => setLabel(e.target.value)} style={{ marginBottom: 0 }} />
        <input type="text" placeholder="remark (optional)" value={remark} onChange={e => setRemark(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} style={{ marginBottom: 0 }} />
        <button onClick={save}>save snapshot</button>
      </div>

      {snaps.length === 0 && <p style={{ ...grey, fontSize: 13 }}>no snapshots yet</p>}

      {snaps.map(s => {
        const inAcc = s.data.accounts.reduce((t, a) => t + a.balance, 0)
        const isOpen = open === s.id
        return (
          <div key={s.id} style={box}>
            <div style={{ ...row, cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : s.id)}>
              <span>{isOpen ? '▾' : '▸'} {s.label}</span>
              <span style={grey}>net {money(inAcc + s.data.owedToMe - s.data.iOwe)}</span>
            </div>
            {s.remark && <p style={{ ...grey, fontSize: 13, margin: '6px 0 0' }}>{s.remark}</p>}
            {isOpen && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <div style={row}><span>salary</span><span>{money(s.data.income)}</span></div>
                <div style={row}><span>planned spending</span><span>{money(s.data.plannedSpend)}</span></div>
                <div style={row}><span>planned savings</span><span>{money(s.data.plannedSave)}</span></div>
                <div style={row}><span>spent logged</span><span>{money(s.data.spent)}</span></div>
                <div style={{ ...grey, marginTop: 8 }}>balances</div>
                {s.data.accounts.map(a => (
                  <div key={a.name} style={{ ...row, paddingLeft: 12 }}><span>{a.name}</span><span>{money(a.balance)}</span></div>
                ))}
                <div style={{ ...row, borderTop: '1px solid #333', marginTop: 6, paddingTop: 6 }}><span>in accounts</span><span>{money(inAcc)}</span></div>
                <div style={row}><span>+ owed to me</span><span>{money(s.data.owedToMe)}</span></div>
                <div style={row}><span>− I owe</span><span>{money(s.data.iOwe)}</span></div>
                <button onClick={() => remove(s)} style={{ marginTop: 8 }}>delete snapshot</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}