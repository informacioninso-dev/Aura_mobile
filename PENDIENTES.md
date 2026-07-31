# Aura móvil — Estado y pendientes

_Última actualización: julio 2026 · último commit de referencia: `0d5c54b`_

Repo propio (`informacioninso-dev/Aura_mobile`, rama `main`), **independiente** del
repo `Aura` (backend/web). El push se hace desde dentro de `Aura_mobile/`.

---

## ✅ Hecho — pulido UX completo

- **Barra de pestañas:** Mi dinero · Lo ganado · ✦ Aura · Lo gastado · ☰ Más
  (etiquetas cortas que caben en una línea).
- **Menú ☰ "Más"** reorganizado por secciones: Finanzas / Herramientas / Cuenta,
  con subtítulos y legal al pie. ("Diferidos" → "Gastos a cuotas").
- **Safe-area real** en las 14 pantallas vía hook `src/hooks/useTopInset.js`
  (antes cada pantalla tenía un `paddingTop` fijo distinto).
- **Design tokens:** `src/theme/theme.js` (colores, radios, espaciado, tipografía).
- **Componente único `ScreenHeader`** (`src/components/ui/ScreenHeader.jsx`) usado
  por las 12 pantallas → encabezados imposibles de desalinear.
- **Colores migrados** a `colors.*` (nada hardcodeado en estilos ni en JSX).
- **Dead code** eliminado (import sin usar + estilos huérfanos del Dashboard).
- **Tono unificado a tuteo** (se quitó el voseo suelto).

Verificación al cierre: babel OK · sin imports faltantes · sin dead code · sin voseo.

---

## ⏳ Pendiente

### 1. Pantalla "Categorías" (prioridad alta)
Única brecha de paridad con la web. La web gestiona **categorías con sus límites**;
en móvil **no existe la pantalla** ni está en el ☰. Falta:
- Crear `src/screens/categorias/CategoriasScreen.jsx` (listar/crear/editar/eliminar,
  endpoint `/finanzas/categorias/`).
- Registrarla en `MasNavigator` y agregar el ítem en el menú ☰ (sección Finanzas).

### 2. Publicar APK (opcional)
`eas build -p android` con las credenciales EAS del usuario (cuenta org "binnso").
Requiere consentimiento explícito antes de lanzar.

---

## 🔧 Cómo trabajar / probar

- Expo corre en `8081`; recargar con **`r`** en la terminal o agitar el teléfono → **Reload**.
- Validar sintaxis de un archivo RN sin abrir la app:
  ```
  node -e "require('@babel/core').transformFileSync(FILE,{presets:['babel-preset-expo']})"
  ```
- Convención: títulos/subtítulos de pantalla siempre vía `<ScreenHeader />`;
  colores siempre desde `colors.*` de `theme.js`; el espacio superior con `useTopInset()`.
