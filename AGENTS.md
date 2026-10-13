# Aura_mobile — Guía para agentes

App móvil de Aura (finanzas personales), **Expo / React Native**. **Repo git propio** (a futuro será un proyecto separado del backend/web).

## 📌 Lo PRIMERO: leé y mantené `MEMORY.md`
Al empezar, leé [MEMORY.md](MEMORY.md): arquitectura, **compatibilidades (Expo/RN)**, cómo correr, build/EAS, estado y novedades. Es la memoria de largo plazo que viaja con el repo.

**Mantenela al día — es parte del trabajo.** Ante una decisión, un gotcha, o una feature destacada → actualizá `MEMORY.md` (y su changelog "Novedades") **en el mismo commit**. Curada y corta.

## ⚠️ Expo / React Native cambian MUCHO entre versiones
Es el error #1 del proyecto. Antes de escribir código, leé los docs de la **versión EXACTA** que usa el repo (`expo` en `package.json` → **hoy SDK 54**: https://docs.expo.dev/versions/v54.0.0/). Instalá paquetes `expo-*` con **`npx expo install`**, nunca `npm install` a secas. Detalle en la sección *Compatibilidades* de `MEMORY.md`.

## Convenciones
- Commits **SIN coautoría**. Español, **tuteo**. El remoto es la fuente de verdad.
- Tokens de `src/theme/theme.js`; no hardcodear colores.
