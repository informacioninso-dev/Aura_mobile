import axios from 'axios'
import { getAccess, getRefresh, setTokens, clearTokens } from './authStorage'

export const API_BASE = 'https://aura.binnso.com/api/'

const api = axios.create({ baseURL: API_BASE, headers: { 'X-Client': 'mobile' } })

const AUTH_BYPASS_PATHS = [
  '/usuarios/login/',
  '/usuarios/token/refresh/',
]

function shouldSkipRefresh(url = '') {
  return AUTH_BYPASS_PATHS.some((path) => url.includes(path))
}

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
    if (
      error.response?.status === 401
      && original
      && !original._retry
      && !shouldSkipRefresh(original.url || '')
    ) {
      original._retry = true
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const refresh = await getRefresh()
            if (!refresh) throw new Error('no refresh')
            const { data } = await axios.post(`${API_BASE}usuarios/token/refresh/`, { refresh }, { headers: { 'X-Client': 'mobile' } })
            await setTokens(data.access, data.refresh || refresh)
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
