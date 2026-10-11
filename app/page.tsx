'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Habits from '@/components/Habits'
import Planner from '@/components/Planner'
import HabitStats from '@/components/HabitStats'
import Journal from '@/components/Journal'
import Finance from '@/components/Finance'
import Lists from '@/components/Lists'
import Debts from '@/components/Debts'
import Projects from '@/components/Projects'
import Food from '@/components/Food'

const TABS = ['planner', 'habits', 'journal', 'finance', 'lists', 'projects', 'food'] as const
type Tab = (typeof TABS)[number]

function todayStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shiftDay(day: string, delta: number) {
  const [y, m, d] = day.split('-').map(Number)
  const x = new Date(y, m - 1, d + delta)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

export default function Home() {
  const [email, setEmail] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr())
  const [version, setVersion] = useState(0)
  const [tab, setTab] = useState<Tab>('planner')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
      else setEmail(data.session.user.email ?? '')
    })
  }, [router])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tab') as Tab | null
      if (saved && TABS.includes(saved)) setTab(saved)
    } catch {}
  }, [])

  function pick(t: Tab) {
    setTab(t)
    try {
      localStorage.setItem('tab', t)
    } catch {}
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (email === null) return null

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#8a8a8a', fontSize: 13 }}>{email}</span>
        <button onClick={logout}>logout</button>
      </div>

      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 16px', borderBottom: '1px solid #333', paddingBottom: 10 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => pick(t)}
            style={{
              background: tab === t ? '#2a2a2a' : 'transparent',
              border: tab === t ? '1px solid #666' : '1px solid #333',
              color: tab === t ? '#fff' : '#8a8a8a',
              padding: '6px 12px',
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'planner' && <Planner />}
      {tab === 'habits' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setDate(shiftDay(date, -1))}>←</button>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => e.target.value && setDate(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <button onClick={() => setDate(shiftDay(date, 1))} disabled={date >= todayStr()}>→</button>
            {date !== todayStr() && <button onClick={() => setDate(todayStr())}>today</button>}
          </div>
          <Habits date={date} onChange={() => setVersion(v => v + 1)} />
          <HabitStats key={version} />
        </>
      )}
      {tab === 'journal' && <Journal />}
      {tab === 'finance' && (
        <>
          <Finance />
          <Debts direction="i_owe" />
          <Debts direction="owed_to_me" />
        </>
      )}
      {tab === 'lists' && <Lists />}
      {tab === 'projects' && <Projects />}
      {tab === 'food' && <Food />}
    </main>
  )
}