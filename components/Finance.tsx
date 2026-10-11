'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Account = { id: string; name: string; purpose: string | null; balance: number }
type Plan = { id: string; account_id: string | null; name: string; amount: number; kind: string }
type Tx = { id: string; account_id: string; plan_item_id: string | null; note: string; amount: number; created_at: string }

const ORDER = ['SBI', 'ICICI', 'POST Bank', 'Cash', 'Groww SIP']
const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

export default function Finance() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plan, setPlan] = useState<Plan[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [accountId, setAccountId] = useState('')
  const [planId, setPlanId] = useState('')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    async function load() {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const { data: a } = await supabase.from('accounts').select('id, name, purpose, balance')
      const { data: p } = await supabase
        .from('plan_items')
        .select('id, account_id, name, amount, kind')
        .order('sort_order')
      const { data: t } = await supabase
        .from('transactions')
        .select('id, account_id, plan_item_id, note, amount, created_at')
        .gte('created_at', monthStart)
        .order('created_at', { ascending: false })
      setAccounts(
        (a ?? [])
          .map(x => ({ ...x, balance: Number(x.balance) }))
          .sort((x, y) => ORDER.indexOf(x.name) - ORDER.indexOf(y.name))
      )
      setPlan((p ?? []).map(x => ({ ...x, amount: Number(x.amount) })))
      setTxs((t ?? []).map(x => ({ ...x, amount: Number(x.amount) })))
    }
    load()
  }, [])

  async function saveBalance(id: string, value: string) {
    const n = Number(value)
    if (value.trim() === '' || Number.isNaN(n)) return
    setAccounts(accounts.map(a => (a.id === id ? { ...a, balance: n } : a)))
    await supabase.from('accounts').update({ balance: n }).eq('id', id)
  }

  async function addTx() {
    const n = Number(amount)
    const acct = accounts.find(a => a.id === accountId)
    if (!acct || !amount.trim() || Number.isNaN(n)) return
    const { data } = await supabase
      .from('transactions')
      .insert({ account_id: accountId, plan_item_id: planId || null, note: note.trim(), amount: n })
      .select('id, account_id, plan_item_id, note, amount, created_at')
      .single()
    if (!data) return
    setTxs([{ ...data, amount: Number(data.amount) }, ...txs])
    const newBalance = acct.balance - n
    setAccounts(accounts.map(a => (a.id === acct.id ? { ...a, balance: newBalance } : a)))
    await supabase.from('accounts').update({ balance: newBalance }).eq('id', acct.id)
    setNote('')
    setAmount('')
  }

  async function removeTx(t: Tx) {
    const acct = accounts.find(a => a.id === t.account_id)
    setTxs(txs.filter(x => x.id !== t.id))
    await supabase.from('transactions').delete().eq('id', t.id)
    if (acct) {
      const newBalance = acct.balance + t.amount
      setAccounts(accounts.map(a => (a.id === acct.id ? { ...a, balance: newBalance } : a)))
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', acct.id)
    }
  }

  const income = plan.filter(p => p.kind === 'income').reduce((s, p) => s + p.amount, 0)
  const planned = plan.filter(p => p.kind !== 'income').reduce((s, p) => s + p.amount, 0)
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const spentOn = (planItemId: string) =>
    txs.filter(t => t.plan_item_id === planItemId).reduce((s, t) => s + t.amount, 0)
  const spentTotal = txs.reduce((s, t) => s + t.amount, 0)

  const box = { background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }
  const row = { display: 'flex', justifyContent: 'space-between' }

  return (
    <section>
      <h2>finance — monthly plan</h2>

      <div style={box}>
        <div style={row}><span>salary</span><span>{money(income)}</span></div>
        <div style={row}><span>planned</span><span>{money(planned)}</span></div>
        <div style={{ ...row, color: '#8a8a8a' }}>
          <span>unplanned</span><span>{money(income - planned)}</span>
        </div>
        <div style={{ ...row, borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
          <span>spent this month</span><span>{money(spentTotal)}</span>
        </div>
        <div style={row}>
          <span>total across accounts</span><span>{money(totalBalance)}</span>
        </div>
      </div>

      {accounts.map(a => {
        const items = plan.filter(p => p.account_id === a.id)
        const gets = items.reduce((s, p) => s + p.amount, 0)
        return (
          <div key={a.id} style={box}>
            <div style={{ ...row, alignItems: 'center' }}>
              <span>
                {a.name}
                {a.purpose && <span style={{ color: '#8a8a8a' }}> — {a.purpose}</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                balance ₹
                <input
                  key={a.id + a.balance}
                  type="text"
                  defaultValue={a.balance}
                  onBlur={e => saveBalance(a.id, e.target.value)}
                  style={{ width: 100, marginBottom: 0, textAlign: 'right' }}
                />
              </span>
            </div>
            {items.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <div style={{ ...row, color: '#8a8a8a' }}>
                  <span>gets each month</span><span>{money(gets)}</span>
                </div>
                {items.map(p => {
                  const spent = spentOn(p.id)
                  return (
                    <div key={p.id} style={{ ...row, paddingLeft: 12 }}>
                      <span>{p.name}</span>
                      <span>
                        {p.kind !== 'income' && spent > 0 && (
                          <span style={{ color: '#8a8a8a' }}>
                            spent {money(spent)} · left {money(p.amount - spent)} ·{' '}
                          </span>
                        )}
                        {money(p.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <h3>spending log</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={accountId} onChange={e => setAccountId(e.target.value)}>
          <option value="">from account…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={planId} onChange={e => setPlanId(e.target.value)}>
          <option value="">no category</option>
          {plan.filter(p => p.kind !== 'income').map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input type="text" placeholder="what for" value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: 0 }} />
        <input type="text" placeholder="amount" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} style={{ marginBottom: 0 }} />
        <button onClick={addTx}>add</button>
      </div>

      {txs.length === 0 && <p style={{ color: '#8a8a8a', fontSize: 13 }}>nothing logged this month</p>}
      {txs.map(t => (
        <div key={t.id} style={{ ...row, fontSize: 13, gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#8a8a8a' }}>
            {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
          <span style={{ flex: 1 }}>
            {t.note || '—'}
            <span style={{ color: '#8a8a8a' }}>
              {' '}· {accounts.find(a => a.id === t.account_id)?.name}
              {t.plan_item_id && ` · ${plan.find(p => p.id === t.plan_item_id)?.name}`}
            </span>
          </span>
          <span>{money(t.amount)}</span>
          <button onClick={() => removeTx(t)}>x</button>
        </div>
      ))}
    </section>
  )
}