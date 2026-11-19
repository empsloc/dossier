'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Snapshots from '@/components/Snapshots'
import Shimmer from '@/components/Shimmer'

type Account = { id: string; name: string; purpose: string | null; balance: number }
type Plan = { id: string; account_id: string | null; name: string; amount: number; kind: string }
type Tx = { id: string; account_id: string; plan_item_id: string | null; note: string; amount: number; created_at: string }
type Debt = { amount: number; settled: boolean; direction: string }

const ORDER = ['SBI', 'ICICI', 'POST Bank', 'Cash', 'Groww SIP']
const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const curMonth = ym(new Date())

export default function Finance() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plan, setPlan] = useState<Plan[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [accountId, setAccountId] = useState('')
  const [planId, setPlanId] = useState('')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(curMonth)
  const [date, setDate] = useState('')
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: a } = await supabase.from('accounts').select('id, name, purpose, balance')
      const { data: p } = await supabase
        .from('plan_items')
        .select('id, account_id, name, amount, kind')
        .order('sort_order')
      const { data: d } = await supabase.from('debts').select('amount, settled, direction')
      setDebts((d ?? []).map(x => ({ ...x, amount: Number(x.amount) })))
      setAccounts(
        (a ?? [])
          .map(x => ({ ...x, balance: Number(x.balance) }))
          .sort((x, y) => ORDER.indexOf(x.name) - ORDER.indexOf(y.name))
      )
      setPlan((p ?? []).map(x => ({ ...x, amount: Number(x.amount) })))
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    supabase
      .from('finance_remarks')
      .select('remark')
      .eq('month', month)
      .maybeSingle()
      .then(({ data }) => setRemark(data?.remark ?? ''))
  }, [month])

  async function saveRemark(value: string) {
    setRemark(value)
    await supabase
      .from('finance_remarks')
      .upsert({ month, remark: value }, { onConflict: 'user_id,month' })
  }

  useEffect(() => {
    const [y, m] = month.split('-').map(Number)
    supabase
      .from('transactions')
      .select('id, account_id, plan_item_id, note, amount, created_at')
      .gte('created_at', new Date(y, m - 1, 1).toISOString())
      .lt('created_at', new Date(y, m, 1).toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => setTxs((data ?? []).map(x => ({ ...x, amount: Number(x.amount) }))))
  }, [month])

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    setMonth(ym(new Date(y, m - 1 + delta, 1)))
  }

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
    const day = date || (month === curMonth ? '' : `${month}-01`)
    const { data } = await supabase
      .from('transactions')
      .insert({
        account_id: accountId,
        plan_item_id: planId || null,
        note: note.trim(),
        amount: n,
        ...(day ? { created_at: new Date(day + 'T12:00:00').toISOString() } : {}),
      })
      .select('id, account_id, plan_item_id, note, amount, created_at')
      .single()
    if (!data) return
    const when = new Date(data.created_at)
    if (ym(when) === month) {
      setTxs(prev =>
        [{ ...data, amount: Number(data.amount) }, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at))
      )
    }
    if (ym(when) === curMonth) {
      const nb = acct.balance - n
      setAccounts(prev => prev.map(a => (a.id === acct.id ? { ...a, balance: nb } : a)))
      await supabase.from('accounts').update({ balance: nb }).eq('id', acct.id)
    }
    setNote('')
    setAmount('')
    setDate('')
  }

  async function editTx(t: Tx, patch: { note?: string; amount?: number }) {
    setTxs(prev => prev.map(x => (x.id === t.id ? { ...x, ...patch } : x)))
    await supabase.from('transactions').update(patch).eq('id', t.id)
    const acct = accounts.find(a => a.id === t.account_id)
    if (patch.amount !== undefined && acct && ym(new Date(t.created_at)) === curMonth) {
      const nb = acct.balance + t.amount - patch.amount
      setAccounts(prev => prev.map(a => (a.id === acct.id ? { ...a, balance: nb } : a)))
      await supabase.from('accounts').update({ balance: nb }).eq('id', acct.id)
    }
  }

  async function removeTx(t: Tx) {
    setTxs(prev => prev.filter(x => x.id !== t.id))
    await supabase.from('transactions').delete().eq('id', t.id)
    const acct = accounts.find(a => a.id === t.account_id)
    if (acct && ym(new Date(t.created_at)) === curMonth) {
      const nb = acct.balance + t.amount
      setAccounts(prev => prev.map(a => (a.id === acct.id ? { ...a, balance: nb } : a)))
      await supabase.from('accounts').update({ balance: nb }).eq('id', acct.id)
    }
  }

  const income = plan.filter(p => p.kind === 'income').reduce((s, p) => s + p.amount, 0)
  const plannedSpend = plan.filter(p => p.kind !== 'income' && p.kind !== 'saving').reduce((s, p) => s + p.amount, 0)
  const plannedSave = plan.filter(p => p.kind === 'saving').reduce((s, p) => s + p.amount, 0)
  const unplanned = income - plannedSpend - plannedSave
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const owedToMe = debts.filter(d => d.direction === 'owed_to_me' && !d.settled).reduce((s, d) => s + d.amount, 0)
  const iOwe = debts.filter(d => d.direction === 'i_owe' && !d.settled).reduce((s, d) => s + d.amount, 0)
  const spentOn = (planItemId: string) =>
    txs.filter(t => t.plan_item_id === planItemId).reduce((s, t) => s + t.amount, 0)
  const spentTotal = txs.reduce((s, t) => s + t.amount, 0)

  const box = { background: '#161616', border: '1px solid #333', padding: 12, marginBottom: 10 }
  const row = { display: 'flex', justifyContent: 'space-between' }

  if (loading) return <section><h2>finance — monthly plan</h2><Shimmer lines={6} /></section>

  return (
    <section>
      <h2>finance — monthly plan</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button onClick={() => shiftMonth(-1)}>←</button>
        <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ marginBottom: 0 }} />
        <button onClick={() => shiftMonth(1)}>→</button>
        {month !== curMonth && <button onClick={() => setMonth(curMonth)}>this month</button>}
      </div>

      <div style={box}>
        <div style={row}><span>salary</span><span>{money(income)}</span></div>
        <div style={row}><span>planned spending</span><span>{money(plannedSpend)}</span></div>
        <div style={row}><span>planned savings</span><span>{money(plannedSave)}</span></div>
        {unplanned !== 0 && (
          <div style={{ ...row, color: unplanned < 0 ? '#e06666' : '#8a8a8a' }}>
            <span>unplanned</span><span>{money(unplanned)}</span>
          </div>
        )}
        <div style={{ ...row, borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
          <span>{month === curMonth ? 'spent so far' : 'spent'}</span>
          <span>{money(spentTotal)} of {money(plannedSpend)}</span>
        </div>
        {month === curMonth && (
          <div style={{ ...row, color: plannedSpend - spentTotal < 0 ? '#e06666' : '#5a9e6f' }}>
            <span>{plannedSpend - spentTotal >= 0 ? 'remaining' : 'over budget'}</span>
            <span>{money(Math.abs(plannedSpend - spentTotal))}</span>
          </div>
        )}
      </div>

      <textarea
        value={remark}
        onChange={e => setRemark(e.target.value)}
        onBlur={e => saveRemark(e.target.value)}
        placeholder="note for this month…"
        rows={2}
        style={{ width: '100%', marginBottom: 10, background: '#161616', border: '1px solid #333', color: '#fff', padding: 8, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
      />

      <div style={box}>
        <div style={{ color: '#8a8a8a', marginBottom: 6 }}>total money</div>
        {accounts.map(a => (
          <div key={a.id} style={row}><span>{a.name}</span><span>{money(a.balance)}</span></div>
        ))}
        <div style={{ ...row, borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
          <span>in accounts</span><span>{money(totalBalance)}</span>
        </div>
        <div style={row}><span>+ owed to me</span><span>{money(owedToMe)}</span></div>
        <div style={row}><span>− I owe</span><span>{money(iOwe)}</span></div>
        <div style={{ ...row, borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
          <span>net total</span><span>{money(totalBalance + owedToMe - iOwe)}</span>
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
                  <span>{items.every(p => p.kind === 'saving') ? 'saves each month' : items.every(p => p.kind === 'income') ? 'earns each month' : 'allocated each month'}</span>
                  <span>{money(gets)}</span>
                </div>
                {items.map(p => {
                  const spent = spentOn(p.id)
                  const left = p.amount - spent
                  const overspent = p.kind !== 'income' && p.kind !== 'saving' && left < 0
                  return (
                    <div key={p.id} style={{ ...row, paddingLeft: 12 }}>
                      <span>{p.name}</span>
                      <span>
                        {p.kind !== 'income' && p.kind !== 'saving' && spent > 0 && (
                          <span style={{ color: overspent ? '#e06666' : '#8a8a8a' }}>
                            spent {money(spent)} · {overspent ? 'over ' + money(Math.abs(left)) : 'left ' + money(left)} ·{' '}
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
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ marginBottom: 0 }} />
        <button onClick={addTx}>add</button>
      </div>

      {txs.length === 0 && <p style={{ color: '#8a8a8a', fontSize: 13 }}>nothing logged this month</p>}
      {txs.map(t => (
        <div key={t.id} style={{ ...row, fontSize: 13, gap: 8, marginBottom: 4, alignItems: 'center' }}>
          <span style={{ color: '#8a8a8a' }}>
            {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
          <input
            key={t.id + t.note}
            type="text"
            defaultValue={t.note}
            placeholder="—"
            onBlur={e => e.target.value !== t.note && editTx(t, { note: e.target.value.trim() })}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <span style={{ color: '#8a8a8a' }}>
            {accounts.find(a => a.id === t.account_id)?.name}
            {t.plan_item_id && ` · ${plan.find(p => p.id === t.plan_item_id)?.name}`}
          </span>
          <input
            key={t.id + t.amount}
            type="text"
            defaultValue={t.amount}
            onBlur={e => {
              const n = Number(e.target.value)
              if (e.target.value.trim() !== '' && !Number.isNaN(n) && n !== t.amount) editTx(t, { amount: n })
            }}
            style={{ width: 80, marginBottom: 0, textAlign: 'right' }}
          />
          <button onClick={() => removeTx(t)}>x</button>
        </div>
      ))}

      <Snapshots
        month={month}
        data={{
          income,
          plannedSpend,
          plannedSave,
          spent: spentTotal,
          accounts: accounts.map(a => ({ name: a.name, balance: a.balance })),
          owedToMe,
          iOwe,
        }}
      />
    </section>
  )
}