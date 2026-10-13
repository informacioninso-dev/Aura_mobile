import { StyleSheet } from 'react-native'

import { colors, radius } from '../../theme/theme'

// Un solo set de estilos para Login, Registro y recuperar contraseña: antes
// Login era violeta con una estrella y Registro verde con otra "A" y otro fondo,
// y quien pasaba de una a otra sentía que cambiaba de app.
export default StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 48, paddingBottom: 32 },
  card: { gap: 14 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: -6, marginBottom: 2 },
  field: { gap: 6 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 50, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg, color: colors.text, paddingHorizontal: 14, fontSize: 15,
  },
  passWrap: {
    flexDirection: 'row', alignItems: 'center', minHeight: 50, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBg,
  },
  passInput: { flex: 1, color: colors.text, paddingHorizontal: 14, fontSize: 15, minHeight: 50 },
  passToggle: { paddingHorizontal: 14, minHeight: 50, justifyContent: 'center' },
  passToggleText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inlineLabel: { color: colors.textMuted, fontSize: 13 },
  inlineStrong: { color: colors.text, fontWeight: '700' },
  inlineLink: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  chips: { gap: 7, paddingRight: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.inputBorder },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(196,135,246,0.15)' },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxActive: { borderColor: colors.primaryStrong, backgroundColor: colors.primaryStrong },
  checkmark: { color: colors.text, fontSize: 13, fontWeight: '900' },
  checkCopy: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 19 },
  legalLink: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  fineprint: { color: colors.textFaint, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  error: {
    padding: 11, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    backgroundColor: 'rgba(248,113,113,0.08)', color: colors.danger, fontSize: 13, lineHeight: 18,
  },
  success: {
    padding: 11, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    backgroundColor: 'rgba(16,185,129,0.08)', color: colors.success, fontSize: 13, lineHeight: 18,
  },
  primary: {
    minHeight: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryStrong, marginTop: 2,
  },
  primaryText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  secondary: {
    minHeight: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(196,135,246,0.3)', backgroundColor: 'rgba(196,135,246,0.08)',
  },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  linkCenter: { alignItems: 'center', paddingVertical: 6 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 },
  footerText: { color: colors.textMuted, fontSize: 13 },
  footerLink: { color: colors.primary, fontSize: 13, fontWeight: '800' },
})
