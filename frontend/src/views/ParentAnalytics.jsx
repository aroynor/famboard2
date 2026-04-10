import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell } from 'recharts'
import { api } from '../api'

const CAT_COLORS = { study: '#378ADD', chore: '#639922', sport: '#D85A30', music: '#7F77DD' }

export default function ParentAnalytics() {
  const [kids, setKids] = useState([])
  const [selectedKid, setSelectedKid] = useState(null)
  const [weekly, setWeekly] = useState([])
  const [category, setCategory] = useState([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

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
      api.getWeekly(selectedKid.id, 6),
      api.getCategory(selectedKid.id, 14),
      api.getStreak(selectedKid.id),
    ]).then(([w, c, s]) => {
      setWeekly(w); setCategory(c); setStreak(s.current_streak)
    }).finally(() => setLoading(false))
  }, [selectedKid])

  if (loading) return <div className="page"><div className="spinner" /></div>

  const totalPts = weekly.reduce((s, w) => s + w.points, 0)
  const avgPct = weekly.length ? Math.round(weekly.reduce((s, w) => s + w.pct, 0) / weekly.length) : 0

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Analytics</h2>
        {kids.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {kids.map(k => (
              <button key={k.id} className={selectedKid?.id === k.id ? 'active' : ''} onClick={() => setSelectedKid(k)} style={{ fontSize: 13 }}>{k.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-box">
          <div className="val" style={{ color: 'var(--accent)' }}>{totalPts}</div>
          <div className="lbl">pts last 6 wks</div>
        </div>
        <div className="stat-box">
          <div className="val">{avgPct}%</div>
          <div className="lbl">avg completion</div>
        </div>
        <div className="stat-box">
          <div className="val" style={{ color: streak > 0 ? 'var(--warning)' : undefined }}>{streak}</div>
          <div className="lbl">current streak</div>
        </div>
      </div>

      <div className="section-title">Weekly points earned</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v} pts`, 'Points']} />
            <Bar dataKey="points" radius={[4, 4, 0, 0]} fill="var(--accent)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-title">Completion rate by week (%)</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v}%`, 'Completion']} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {weekly.map((entry, i) => (
                <Cell key={i} fill={entry.pct >= 80 ? '#1D9E75' : entry.pct >= 50 ? '#BA7517' : '#A32D2D'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-title">Category breakdown (last 14 days)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {category.map(c => (
          <div key={c.category} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`badge ${c.category}`} style={{ width: 54, justifyContent: 'center' }}>{c.category}</span>
            <div style={{ flex: 1 }}>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${c.pct}%`, background: CAT_COLORS[c.category] || 'var(--accent)' }} />
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 80, textAlign: 'right' }}>
              {c.done}/{c.total} · {c.points}pts
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
