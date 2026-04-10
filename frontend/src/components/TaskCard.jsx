import { useState } from 'react'
import { api } from '../api'

const CAT_LABELS = { chore: 'Chore', study: 'Study', sport: 'Sport', music: 'Music' }

export default function TaskCard({ log, onUpdate, readOnly = false }) {
  const [saving, setSaving] = useState(false)
  const [comment, setComment] = useState(log.comment || '')

  async function toggle() {
    if (readOnly) return
    setSaving(true)
    try {
      const updated = await api.updateLog(log.id, { done: !log.done })
      onUpdate(updated)
    } finally {
      setSaving(false)
    }
  }

  async function saveComment(e) {
    if (readOnly) return
    const val = e.target.value
    setComment(val)
    await api.updateLog(log.id, { comment: val })
  }

  const pts = (log.task_points || 0) + (log.bonus_pts || 0)

  return (
    <div className={`task-card${log.done ? ' done' : ''}`}>
      <button
        className={`check-circle${log.done ? ' checked' : ''}`}
        onClick={toggle}
        disabled={saving || readOnly}
        aria-label={log.done ? 'Mark undone' : 'Mark done'}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <polyline points="1.5,6 5,9.5 10.5,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-hint)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {log.task_time_slot}
          </span>
          <span className="task-name" style={{ fontSize: 14, fontWeight: 500 }}>
            {log.task_name}
          </span>
          <span className={`badge ${log.task_category}`}>
            {CAT_LABELS[log.task_category] || log.task_category}
          </span>
          <span className={`pts-pill${log.done ? ' earned' : ''}`}>
            +{pts} pts
          </span>
        </div>

        {!readOnly && (
          <input
            style={{ marginTop: 6, border: 'none', padding: '2px 0', background: 'transparent', fontSize: 13, color: 'var(--text-muted)' }}
            placeholder="Add a comment…"
            value={comment}
            onChange={saveComment}
          />
        )}
        {readOnly && log.comment && (
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>{log.comment}</p>
        )}
      </div>
    </div>
  )
}
