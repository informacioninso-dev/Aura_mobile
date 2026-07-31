import { View, Text, StyleSheet } from 'react-native'
import { colors, typography } from '../../theme/theme'

// Encabezado único de todas las pantallas: mismo tamaño, peso y ritmo vertical.
// Antes cada pantalla dibujaba su propio <Text> de título y con el tiempo se
// desalineaban (gaps 12/16/24, subtítulos 13/14...). Con un solo componente eso
// no puede volver a pasar.
//
//  - padded: agrega el margen lateral de 16 (pantallas con FlatList cuyo root no
//    tiene padding horizontal). Las que ya van dentro de un contenedor con
//    padding lo dejan en false.
//  - accent: título de marca (morado, más grande) para la pantalla estrella.
export default function ScreenHeader({ title, subtitle, padded = false, accent = false }) {
  return (
    <View style={[styles.wrap, padded && styles.padded]}>
      <Text style={[typography.title, subtitle && styles.titleTight, accent && styles.accent]}>
        {title}
      </Text>
      {subtitle ? <Text style={typography.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', marginBottom: 16 },
  padded: { paddingHorizontal: 16 },
  titleTight: { marginBottom: 2 },
  accent: { color: colors.primary, fontSize: 24, fontWeight: '800' },
})
