import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Espacio superior estándar de todas las pantallas. En vez de un paddingTop fijo
// (que en teléfonos con notch grande deja el título pegado o tapado, y quedaba
// distinto en cada pantalla), respetamos el inset real del dispositivo y le
// sumamos siempre el mismo aire, así todas arrancan parejas en cualquier equipo.
export function useTopInset(extra = 14) {
  const insets = useSafeAreaInsets()
  return insets.top + extra
}
