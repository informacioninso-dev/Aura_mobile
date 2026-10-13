# MEMORY — Memoria de largo plazo de Aura_mobile

> Memoria del proyecto que **viaja con el repo**. Cómo mantenerla: ver [AGENTS.md](AGENTS.md).
> **Repo git PROPIO** y autocontenido — a futuro será un proyecto separado del backend/web, así que esta memoria NO depende de la del repo principal.
> Mantenerla **curada y corta** (se lee cada sesión). Última actualización: **2026-10-13**.

## 1. Qué es
App móvil de Aura (finanzas personales), **Expo / React Native**. Repo `informacioninso-dev/Aura_mobile`, rama `main`. Consume la **API de PRODUCCIÓN**: `https://aura.binnso.com/api/` (`src/api/client.js`) — **no hay backend local propio**; se prueba contra prod.

## 2. ⚠️ Compatibilidades (LO MÁS IMPORTANTE)
Expo y React Native cambian **mucho** entre versiones; romper la matriz de compatibilidad es el error #1 de este proyecto.
- **Hoy: Expo SDK `54`, React Native `0.81.5`.** App version **1.4.0**, package Android **`com.binnso.aura`**.
- **Antes de escribir código, leé los docs de la versión EXACTA** que usa el proyecto: mirá `expo` en `package.json` → p. ej. hoy `https://docs.expo.dev/versions/v54.0.0/`. No asumas APIs de otra versión.
- Para agregar/actualizar paquetes **`expo-*` usá `npx expo install <pkg>`** (NO `npm install` a secas): resuelve la versión que el SDK soporta. Un `expo-*` fuera de rango rompe en runtime.
- `npx expo start` avisa *"expected version"* de paquetes desfasados (vistos desalineados: `expo-local-authentication`, `expo-notifications`, `expo-splash-screen`) → alinearlos con `npx expo install`.
- Para subir de SDK: seguir la **guía de upgrade oficial** de Expo (cambios de API, config plugins), no bumpear versiones a mano.

## 3. Correr / validar
- `npx expo start` (Metro en **8081**). Expo Go: escanear QR o `exp://<IP-LAN>:8081`. Reload: agitar el teléfono.
- **Antes de cada commit: `npm run verificar`** (`scripts/verificar.js`): sintaxis + identificadores sin importar + hooks después de un `return` temprano. Babel solo NO alcanza: esos dos errores pasaban la sintaxis y tiraban la app en runtime.
- Como pega a PROD, se loguea con **cuenta real** de aura.binnso.com (las de prueba local no sirven acá).

## 4. Build / publicar (EAS)
- `eas.json` perfiles: `development`, `preview` (APK interno), `production` (AAB para Play, `autoIncrement`), `production-apk`. `appVersionSource: remote` (EAS maneja `versionCode`).
- APK para probar: `npx eas-cli build -p android --profile preview`.
- Play Store: `npx eas-cli build -p android --profile production` → `npx eas-cli submit -p android`.
- Credenciales EAS = del usuario (org **binnso**); `eas-cli` no está local (usar `npx`). **Pedir consentimiento antes de lanzar un build** (consume créditos y es acción hacia afuera).

## 5. Convenciones / UX
- 🎯 **Prioridad de producto: la app móvil es la puerta de entrada de clientes y debe poder ser la ÚNICA app que use la gente** (no un acompañante de la web). Su UX/UI tiene que ser la mejor de Aura: sentirse nativa, rápida y cuidada. Toda feature nueva debe pensarse primero para móvil.
- Design tokens en `src/theme/theme.js` → usar `colors.*`, **no hardcodear** colores. `ScreenHeader` único; safe-area vía hook `useTopInset`. Español, **tuteo**.
- Commits **SIN coautoría**. El **remoto es la fuente de verdad** (se trabaja desde varias máquinas).

## 6. Estado y pendientes
- **Hecho**: pulido UX (tokens, `ScreenHeader`, safe-area). Outlook de proyección en el Dashboard (meses en positivo/rojo). Navegador de mes + chip `vN` en Gastos fijos.
- **Pendiente (paridad con web)**: pantalla "Categorías"; simulador "Agregar a mis gastos" por tipo; asistente **multi-movimiento** (hoy consume objeto plano = un solo movimiento); fuente de marca **Plus Jakarta Sans** (la web ya la tiene self-hosted). El **versionado** de gastos NO existe en móvil (es solo web).

- **Copy (Ecuador)**: mismas reglas que la web — tuteo (nunca voseo), "registrar" (no "cargar"), "contraseña" (no "clave"), plan "Gratis" (no "Free"), errores "No pudimos … Intenta de nuevo.", sin "correctamente", "gastos a cuotas" (no "diferidos") en textos visibles. El asistente se llama **"Dile a Aura"**. Al cambiar un texto en la web, replicarlo aquí (y viceversa).

## 7. Novedades (changelog — agregar arriba)
- **2026-10-13** — Auditoría UX "Primer minuto en Aura" (https://claude.ai/artifact/MuYCK3WfygDfvANwDgnjSD), aprobada por el usuario. Entrega 1: fix de 2 caídas (ProjectionChart sin importar `TouchableOpacity` → crash en Pro al pasar de 12 meses; Simulador con hook después de return). Ícono, ícono adaptativo y splash con el logo real (sobre blanco: la barra azul marino del logo no se ve sobre el fondo oscuro). Fuera del Dashboard: "Cerrar sesión" (sin confirmar) y la insignia de plan. `npm run verificar`.
- **2026-10-13** — Copy alineado con la web: ortografía, asistente "Dile a Aura" (+ accessibilityLabel en el botón central), estados vacíos por pestaña, textos de proyección sin jerga ("Meses atrás/adelante", "Con tu historial"). Pendiente: `Aura v1.0` hardcodeado en Perfil (la app es 1.4.0).
- **2026-10** — Navegador de mes + chip de versión en Gastos fijos. Outlook de proyección en el Dashboard.
