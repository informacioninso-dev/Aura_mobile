import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client'
import { setTokens, clearTokens, getAccess } from '../api/authStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchMe() {
    try {
      const { data } = await api.get('/usuarios/me/')
      setUser(data)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    getAccess().then((token) => {
      if (token) fetchMe().finally(() => setLoading(false))
      else setLoading(false)
    })
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/usuarios/token/', { email, password })
    await setTokens(data.access, data.refresh)
    await fetchMe()
  }

  async function logout() {
    await clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
