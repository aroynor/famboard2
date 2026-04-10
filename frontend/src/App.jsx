import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import Login from './views/Login.jsx'
import KidToday from './views/KidToday.jsx'
import KidRewards from './views/KidRewards.jsx'
import ParentDashboard from './views/ParentDashboard.jsx'
import ParentTasks from './views/ParentTasks.jsx'
import ParentAnalytics from './views/ParentAnalytics.jsx'
import ParentRewards from './views/ParentRewards.jsx'

function Nav() {
  const { user, logout } = useAuth()
  if (!user) return null
  const isParent = user.role === 'parent'
  return (
    <nav className="nav">
      <span className="nav-brand">FamBoard</span>
      {isParent ? (
        <>
          <NavLink to="/parent" end>Overview</NavLink>
          <NavLink to="/parent/tasks">Tasks</NavLink>
          <NavLink to="/parent/analytics">Analytics</NavLink>
          <NavLink to="/parent/rewards">Rewards</NavLink>
        </>
      ) : (
        <>
          <NavLink to="/kid" end>Today</NavLink>
          <NavLink to="/kid/rewards">Rewards</NavLink>
        </>
      )}
      <button className="ghost" onClick={logout} style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Sign out
      </button>
    </nav>
  )
}

function Guard({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'parent' ? '/parent' : '/kid'} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/kid" element={<Guard role="kid"><KidToday /></Guard>} />
          <Route path="/kid/rewards" element={<Guard role="kid"><KidRewards /></Guard>} />
          <Route path="/parent" element={<Guard role="parent"><ParentDashboard /></Guard>} />
          <Route path="/parent/tasks" element={<Guard role="parent"><ParentTasks /></Guard>} />
          <Route path="/parent/analytics" element={<Guard role="parent"><ParentAnalytics /></Guard>} />
          <Route path="/parent/rewards" element={<Guard role="parent"><ParentRewards /></Guard>} />
          <Route path="*" element={<AuthRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function AuthRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'parent' ? '/parent' : '/kid'} replace />
}
