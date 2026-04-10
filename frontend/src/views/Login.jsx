import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const user = await login(username, password)
      navigate(user.role === 'parent' ? '/parent' : '/kid', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>FamBoard</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Family schedule & reward tracker</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. liam or dad"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
              {error}
            </div>
          )}
          <button type="submit" className="primary" style={{ width: '100%', padding: '10px' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
