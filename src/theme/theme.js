// Design tokens: única fuente de verdad para color, espaciado, radios y tipografía.
// Antes cada pantalla repetía los mismos hex/rgba a mano y terminaban
// desalineándose entre sí; ahora se ajustan aquí una vez y aplican en toda la app.

export const colors = {
  bg: '#0F172A',
  primary: '#C487F6',
  primaryStrong: '#8B5CF6',
  success: '#10B981',
  danger: '#F87171',

  text: '#fff',
  textMuted: 'rgba(255,255,255,0.4)',
  textFaint: 'rgba(255,255,255,0.35)',

  surface: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.08)',
  // Bordes semánticos: el color indica de qué es la tarjeta.
  borderIncome: 'rgba(16,185,129,0.2)',
  borderExpense: 'rgba(248,113,113,0.2)',
  borderAccent: 'rgba(196,135,246,0.2)',
}

export const radius = { sm: 12, md: 14, lg: 16, xl: 20 }

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }

// Tipografía de encabezados: un solo lugar define tamaño/peso/color de los
// títulos y subtítulos de pantalla, así todas las vistas se ven parejas.
export const typography = {
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textFaint, fontSize: 13 },
}
