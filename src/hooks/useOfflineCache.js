import { useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export function useOfflineCache(key) {
  const guardar = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(`aura_cache_${key}`, JSON.stringify({ data, ts: Date.now() }))
    } catch {}
  }, [key])

  const leer = useCallback(async (maxAgeMs = 5 * 60 * 1000) => {
    try {
      const raw = await AsyncStorage.getItem(`aura_cache_${key}`)
      if (!raw) return null
      const { data, ts } = JSON.parse(raw)
      if (Date.now() - ts > maxAgeMs) return null
      return data
    } catch { return null }
  }, [key])

  const limpiar = useCallback(async () => {
    try { await AsyncStorage.removeItem(`aura_cache_${key}`) } catch {}
  }, [key])

  return { guardar, leer, limpiar }
}
