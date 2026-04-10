import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../hooks/useAuth.jsx'

const CATS = ['study', 'chore', 'sport', 'music']
const RECS = ['daily', 'weekdays', 'weekend', 'weekly', 'once']

const blankForm = { name: '', category: 'study', time_slot: '09:00', duration_min: 30, points: 10, recurrence: 'daily', assigned_to: '' }

export default function ParentTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [kids, setKids] = useState([])
  const [form, setForm] = useState(blankForm)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    Promise.all([api.getTasks(), api.getUsers()]).then(([t, u]) => {
      setTasks(t)
      const k = u.filter(u => u.role === 'kid')
      setKids(k)
      if (k.length > 0) setForm(f => ({ ...f, assigned_to: k[0].id }))
    })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    try {
      if (editing) {
        const updated = await api.updateTask(editing, form)
        setTasks(prev => prev.map(t => t.id === editing ? updated : t))
      } else {
        const created = await api.createTask({ ...form, assigned_to: parseInt(form.assigned_to) })
        setTasks(prev => [...prev, created])
      }
      setShowForm(false); setEditing(null); setForm({ ...blankForm, assigned_to: kids[0]?.id || '' })
      setMsg(editing ? 'Task updated.' : 'Task created.')
    } catch (err) { setMsg(err.message) }
  }

  async function archive(id) {
    await api.deleteTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function startEdit(t) {
    setForm({ name: t.name, category: t.category, time_slot: t.time_slot, duration_min: t.duration_min, points: t.points, recurrence: t.recurrence, assigned_to: t.assigned_to })
    setEditing(t.id); setShowForm(true); setMsg('')
  }

  async function seed() {
    const res = await api.seedData()
    setMsg(res.message)
    const t = await api.getTasks()
    setTasks(t); setSeeded(true)
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Manage tasks</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {!seeded && tasks.length === 0 && (
            <button onClick={seed} style={{ fontSize: 13 }}>Seed sample tasks</button>
          )}
          <button className="primary" onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ ...blankForm, assigned_to: kids[0]?.id || '' }) }}>
            {showForm ? 'Cancel' : '+ New task'}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12 }}>{msg}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>{editing ? 'Edit task' : 'New task'}</div>
          <form onSubmit={submit}>
            <div className="form-row">
              <label>Task name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Guitar practice" />
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label>Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Time slot</label>
                <input type="time" value={form.time_slot} onChange={e => set('time_slot', e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Duration (min)</label>
                <input type="number" value={form.duration_min} onChange={e => set('duration_min', parseInt(e.target.value))} min="5" />
              </div>
              <div className="form-row">
                <label>Points</label>
                <input type="number" value={form.points} onChange={e => set('points', parseInt(e.target.value))} min="1" />
              </div>
              <div className="form-row">
                <label>Recurrence</label>
                <select value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
                  {RECS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Assigned to</label>
                <select value={form.assigned_to} onChange={e => set('assigned_to', parseInt(e.target.value))}>
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="primary">{editing ? 'Update task' : 'Create task'}</button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.sort((a, b) => a.time_slot.localeCompare(b.time_slot)).map(t => (
          <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-hint)', width: 36, flexShrink: 0 }}>{t.time_slot}</span>
            <span className={`badge ${t.category}`}>{t.category}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.recurrence}</span>
            <span className="pts-pill">+{t.points}</span>
            <button className="ghost" onClick={() => startEdit(t)} style={{ fontSize: 13 }}>Edit</button>
            <button className="ghost" onClick={() => archive(t.id)} style={{ fontSize: 13, color: 'var(--danger)' }}>Archive</button>
          </div>
        ))}
      </div>
    </div>
  )
}
