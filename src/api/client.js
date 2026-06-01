import axios from 'axios'
import { getAccess, getRefresh, setTokens, clearTokens } from './authStorage'

export const API_BASE = 'https://aura.binnso.com/api'

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use(async (config) => {
  const token = await getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const refresh = await getRefresh()
            if (!refresh) throw new Error('no refresh')
            const { data } = await axios.post(`${API_BASE}/usuarios/token/refresh/`, { refresh })
            await setTokens(data.access, refresh)
            return data.access
          } catch {
            await clearTokens()
            return null
          } finally {
            refreshing = null
          }
        })()
      }
      const token = await refreshing
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)

export default api
