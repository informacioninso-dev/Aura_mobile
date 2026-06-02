import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registrarNotificaciones() {
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  return finalStatus === 'granted'
}

export async function notificarPresupuesto(categoria, pct) {
  if (pct < 80) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: pct >= 100 ? `⚠️ Límite superado: ${categoria}` : `🔔 Atención: ${categoria}`,
      body: pct >= 100
        ? `Superaste el límite mensual de ${categoria}.`
        : `Alcanzaste el ${pct}% del límite de ${categoria}.`,
      data: { categoria },
    },
    trigger: null,
  })
}

export function useNotificationListener(onNotification) {
  const listenerRef = useRef(null)

  useEffect(() => {
    listenerRef.current = Notifications.addNotificationReceivedListener(onNotification)
    return () => listenerRef.current?.remove()
  }, [])
}
