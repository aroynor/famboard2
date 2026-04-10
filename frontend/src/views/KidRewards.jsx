import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth.jsx'

export default function KidRewards() {
  const { user } = useAuth()
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [points, setPoints] = useState({ week: 0 })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getRewards(), api.getRedemptions(), api.getPoints(user.id)])
      .then(([r, red, pts]) => { setRewards(r); setRedemptions(red); setPoints(pts) })
      .finally(() => setLoading(false))
  }, [user.id])

  async function redeem(id) {
    try {
      const res = await api.redeemReward(id)
      setMsg(res.message)
      const [red, pts] = await Promise.all([api.getRedemptions(), api.getPoints(user.id)])
      setRedemptions(red); setPoints(pts)
    } catch (err) {
      setMsg(err.message)
    }
  }

  const pendingIds = new Set(redemptions.filter(r => !r.approved).map(r => r.reward_id))

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Reward shop</h2>
        <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>{points.week} pts this week</span>
      </div>

      {msg && (
        <div style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: 13, padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rewards.map(r => {
          const pending = pendingIds.has(r.id)
          const canAfford = points.week >= r.cost_pts
          return (
            <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{r.name}</div>
                {r.description && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.description}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--warning)', marginBottom: 6 }}>{r.cost_pts} pts</div>
                {pending ? (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending approval</span>
                ) : (
                  <button
                    className={canAfford ? 'primary' : ''}
                    disabled={!canAfford}
                    onClick={() => redeem(r.id)}
                    style={{ fontSize: 13, padding: '5px 14px' }}
                  >
                    {canAfford ? 'Redeem' : 'Not enough'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {redemptions.length > 0 && (
        <>
          <div className="section-title">Redemption history</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
