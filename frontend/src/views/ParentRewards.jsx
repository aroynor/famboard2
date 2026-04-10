import { useState, useEffect } from 'react'
import { api } from '../api'

const blank = { name: '', description: '', cost_pts: 50 }

export default function ParentRewards() {
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    Promise.all([api.getRewards(), api.getRedemptions()])
      .then(([r, red]) => { setRewards(r); setRedemptions(red) })
  }, [])

  async function submit(e) {
    e.preventDefault()
    const r = await api.createReward({ ...form, cost_pts: parseInt(form.cost_pts) })
    setRewards(prev => [...prev, r])
    setForm(blank); setShowForm(false); setMsg('Reward created.')
  }

  async function approve(id) {
    await api.approveRedemption(id)
    setRedemptions(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r))
    setMsg('Redemption approved!')
  }

  const pending = redemptions.filter(r => !r.approved)

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Rewards</h2>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New reward'}
        </button>
      </div>

      {msg && <div style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12 }}>{msg}</div>}

      {pending.length > 0 && (
        <>
          <div className="section-title" style={{ color: 'var(--warning)' }}>Pending approval ({pending.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {pending.map(r => (
              <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{r.reward_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.pts_spent} pts</div>
                </div>
                <button className="primary" onClick={() => approve(r.id)} style={{ fontSize: 13 }}>Approve</button>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>New reward</div>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>Reward name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Extra screen time" />
            </div>
            <div className="form-row">
              <label>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details" />
            </div>
            <div className="form-row">
              <label>Cost (points)</label>
              <input type="number" value={form.cost_pts} onChange={e => setForm(f => ({ ...f, cost_pts: e.target.value }))} min="1" />
            </div>
            <button type="submit" className="primary">Create reward</button>
          </form>
        </div>
      )}

      <div className="section-title">Active rewards</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rewards.map(r => (
          <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{r.name}</div>
              {r.description && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.description}</div>}
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--warning)' }}>{r.cost_pts} pts</span>
          </div>
        ))}
      </div>

      {redemptions.length > 0 && (
        <>
          <div className="section-title">All redemptions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {redemptions.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: 14 }}>{r.reward_name}</span>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99, background: r.approved ? 'var(--success-light)' : 'var(--warning-light)', color: r.approved ? 'var(--success)' : 'var(--warning)' }}>
                  {r.approved ? 'Approved' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
