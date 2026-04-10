import { useState, useEffect, useCallback } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth.jsx'
import TaskCard from '../components/TaskCard.jsx'

const CATS = ['all', 'study', 'sport', 'chore', 'music']

export default function KidToday() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date())
  const [logs, setLogs] = useState([])
  const [points, setPoints] = useState({ today: 0, week: 0, month: 0 })
  const [streak, setStreak] = useState(0)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const dateStr = format(date, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [logsData, ptsData, streakData] = await Promise.all([
        api.getLogs(dateStr),
        api.getPoints(user.id),
        api.getStreak(user.id),
      ])
      setLogs(logsData)
      setPoints(ptsData)
      setStreak(streakData.current_streak)
    } finally {
      setLoading(false)
    }
  }, [dateStr, user.id])

  useEffect(() => { load() }, [load])

  function handleUpdate(updated) {
    setLogs(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
    api.getPoints(user.id).then(setPoints)
  }

  const visible = logs.filter(l => filter === 'all' || l.task_category === filter)
  const done = logs.filter(l => l.done).length
  const total = logs.length
  const pct = total ? Math.round(done / total * 100) : 0

  return (
    <div className="page">
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="ghost" onClick={() => setDate(d => subDays(d, 1))} style={{ fontSize: 20, padding: '4px 10px' }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{format(date, 'EEEE, d MMM')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hey {user.name}!</div>
        </div>
        <button className="ghost" onClick={() => setDate(d => addDays(d, 1))} style={{ fontSize: 20, padding: '4px 10px' }}>›</button>
      </div>

      {/* Stats */}
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
          <div className="lbl">done today</div>
        </div>
        <div className="stat-box">
          <div className="val" style={{ color: streak > 0 ? 'var(--warning)' : undefined }}>
            {streak}
          </div>
          <div className="lbl">day streak</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>Daily progress</span>
          <span>{pct}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Category filter */}
      <div className="tab-row">
        {CATS.map(c => (
          <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Tasks */}
      {loading ? (
        <div className="spinner" />
      ) : visible.length === 0 ? (
        <div className="empty-state">No {filter === 'all' ? '' : filter} tasks for today</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(log => (
            <TaskCard key={log.id} log={log} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
