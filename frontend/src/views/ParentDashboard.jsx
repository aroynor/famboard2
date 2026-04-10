import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth.jsx'
import TaskCard from '../components/TaskCard.jsx'

export default function ParentDashboard() {
  const { user } = useAuth()
  const [kids, setKids] = useState([])
  const [selectedKid, setSelectedKid] = useState(null)
  const [logs, setLogs] = useState([])
  const [points, setPoints] = useState({ today: 0, week: 0 })
  const [streak, setStreak] = useState(0)
  const [bonusPts, setBonusPts] = useState('')
  const [bonusReason, setBonusReason] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    api.getUsers().then(users => {
      const k = users.filter(u => u.role === 'kid')
      setKids(k)
      if (k.length > 0) setSelectedKid(k[0])
    })
  }, [])

  useEffect(() => {
    if (!selectedKid) return
    setLoading(true)
    Promise.all([
      api.getLogsForKid(selectedKid.id, today),
      api.getPoints(selectedKid.id),
      api.getStreak(selectedKid.id),
    ]).then(([l, p, s]) => {
      setLogs(l); setPoints(p); setStreak(s.current_streak)
    }).finally(() => setLoading(false))
  }, [selectedKid, today])

  async function grantBonus() {
    if (!bonusPts || !selectedKid) return
    try {
      await api.addBonus({ user_id: selectedKid.id, pts: parseInt(bonusPts), reason: bonusReason })
      setMsg(`+${bonusPts} bonus pts granted!`)
      setBonusPts(''); setBonusReason('')
      const pts = await api.getPoints(selectedKid.id)
      setPoints(pts)
    } catch (err) { setMsg(err.message) }
  }

  const done = logs.filter(l => l.done).length
  const total = logs.length
  const pct = total ? Math.round(done / total * 100) : 0

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Today's overview</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{format(new Date(), 'EEE, d MMM')}</span>
      </div>

      {/* Kid selector */}
      {kids.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {kids.map(k => (
            <button key={k.id} className={selectedKid?.id === k.id ? 'active' : ''} onClick={() => setSelectedKid(k)}>
              {k.name}
            </button>
          ))}
        </div>
      )}

      {selectedKid && (
        <>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="val" style={{ color: 'var(--accent)' }}>{points.today}</div>
              <div className="lbl">today's pts</div>
            </div>
            <div className="stat-box">
              <div className="val">{points.week}</div>
              <div className="lbl">this week</div>
            </div>
            <div className="stat-box">
              <div className="val">{done}/{total}</div>
              <div className="lbl">tasks done</div>
            </div>
            <div className="stat-box">
              <div className="val" style={{ color: streak > 0 ? 'var(--warning)' : undefined }}>{streak}</div>
              <div className="lbl">day streak</div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>{selectedKid.name}'s progress today</span>
              <span>{pct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Bonus points */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Grant bonus points</div>
            {msg && <div style={{ fontSize: 13, color: 'var(--success)', marginBottom: 10 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ width: 80 }}>
                <input type="number" placeholder="pts" value={bonusPts} onChange={e => setBonusPts(e.target.value)} min="1" />
              </div>
              <div style={{ flex: 1 }}>
                <input placeholder="Reason (optional)" value={bonusReason} onChange={e => setBonusReason(e.target.value)} />
              </div>
              <button className="primary" onClick={grantBonus} disabled={!bonusPts}>Grant</button>
            </div>
          </div>

          {/* Today's task list (read-only) */}
          <div className="section-title">{selectedKid.name}'s tasks today</div>
          {loading ? <div className="spinner" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(log => (
                <TaskCard key={log.id} log={log} onUpdate={() => {}} readOnly />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
