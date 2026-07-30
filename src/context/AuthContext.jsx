import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client'
import { setTokens, clearTokens, getAccess, getRefresh } from '../api/authStorage'
import { setMoneyCurrency } from '../utils/formatters'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchMe() {
    try {
      const { data } = await api.get('/usuarios/perfil/')
      setUser(data)
      setMoneyCurrency(data?.moneda_preferida)
      return data
    } catch {
      setUser(null)
      setMoneyCurrency('USD')
      return null
    }
  }

  async function restoreSession() {
    const [access, refresh] = await Promise.all([getAccess(), getRefresh()])
    if (!access && !refresh) {
      setUser(null)
      return false
    }

    const data = await fetchMe()
    if (!data) {
      await clearTokens()
      return false
    }

    return true
  }

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        await restoreSession()
      } finally {
        if (mounted) setLoading(false)
      }
    }

    bootstrap()

    return () => {
      mounted = false
    }
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/usuarios/login/', { email, password })
    await setTokens(data.access, data.refresh || '')
    await fetchMe()
  }

  // Tras registrarse se entra directo: el backend ya valido el correo y la clave,
  // pedirlas otra vez en el login seria friccion sin proposito.
  async function register(payload) {
    await api.post('/usuarios/registro/', payload)
    await login(payload.email, payload.password)
  }

  async function forgotPassword(email) {
    const { data } = await api.post('/usuarios/password/forgot/', { email })
    return data
  }

  // uid y token llegan en el enlace del correo. El backend invalida las sesiones
  // abiertas al cambiar la clave, por eso hay que volver a iniciar sesion.
  async function resetPassword({ uid, token, newPassword }) {
    const { data } = await api.post('/usuarios/password/reset/', {
      uid,
      token,
      new_password: newPassword,
    })
    return data
  }

  async function logout() {
    try {
      const refresh = await getRefresh()
      if (refresh) {
        await api.post('/usuarios/logout/', { refresh })
      }
    } catch {
      // Even if the API logout fails, local session must be cleared.
    } finally {
      await clearTokens()
      setUser(null)
      setMoneyCurrency('USD')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, forgotPassword, resetPassword, logout, restoreSession, fetchMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
