import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('famboard_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  async function login(username, password) {
    setLoading(true)
    try {
      const data = await api.login(username, password)
      localStorage.setItem('famboard_token', data.access_token)
      const me = await api.me()
      localStorage.setItem('famboard_user', JSON.stringify(me))
      setUser(me)
      return me
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('famboard_token')
    localStorage.removeItem('famboard_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
