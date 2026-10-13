# De la v1 a la v2: qué cambió y por qué

Resumen de la revisión de código de la primera versión y de lo que se hizo con cada hallazgo.

## Errores corregidos

| Problema en la v1 | Qué pasaba | Solución en la v2 |
| --- | --- | --- |
| Monedas sin convertir | El inicio y los presupuestos sumaban USD, EUR y ARS como si fueran lo mismo. La pantalla de tasas guardaba datos que nada usaba, y el selector de moneda solo cambiaba una etiqueta. | `convert()` en `core.js` usa tasa directa, inversa o pasa por USD. Si no hay tasa, devuelve `null` y la interfaz avisa. |
| Presupuesto "mensual" sin mes | Sumaba los gastos de toda la historia de la categoría. | `budgetStatus()` filtra por el mes elegido y convierte a la moneda del presupuesto. |
| Fechas en UTC | `toISOString()` adelantaba el día después de las 21:00 en Argentina, y con eso fallaban los vencimientos. | `toLocalDateString()` arma la fecha con los getters locales; `daysUntil()` cuenta días de calendario. |
| Deudas vencidas sin aviso | El filtro `fechaVencimiento >= hoy` dejaba afuera justo las vencidas. | `debtsNeedingAttention()` incluye vencidas y las que vencen en los próximos 3 días. |
| Recordatorios con `Notification` | La API del navegador no es confiable en un WebView. | `@capacitor/local-notifications` programa avisos reales; en el navegador queda un aviso diario. |
| Lista de compras | Al quitar el último producto no se guardaba y reaparecía al recargar. El símbolo `$` estaba fijo. | Se guarda siempre y usa la moneda elegida. |
| Botón "Copiar" del respaldo | Metía el JSON dentro de un `onclick`; se rompía con saltos de línea. | Se asigna con `textContent` y se copia desde un manejador de eventos. |
| Respaldo sin validar | Restaurar aceptaba cualquier JSON y escribía los valores tal cual. | `parseBackup()` valida cada registro, descarta los dañados y cuenta cuántos. |
| `backup.html` sin menú | Tenía comentarios `<!-- mismo menú -->` en lugar de navegación. | Menú compartido en todas las páginas. |

## Seguridad

- **XSS:** descripción, categoría y concepto se insertaban con `innerHTML` sin escapar. Ahora todo pasa por `escapeHtml()` (que también escapa comillas) y los avisos usan `textContent`.
- **Dependencias:** se quitó `sortablejs@latest` (versión sin fijar) y Font Awesome. Tailwind se compila y se incluye en el repo; Chart.js queda fijado en 4.4.1.
- **Eventos:** se eliminaron los `onclick="..."` con datos incrustados; ahora se usa delegación de eventos con `data-action`.

## Estructura y mantenimiento

- El menú, los avisos, la moneda y los recordatorios estaban copiados en las 10 páginas. Ahora viven en `layout.js`, `ui.js`, `storage.js` y `notifications.js`.
- Gastos e ingresos eran dos páginas casi idénticas; comparten `transactions.js`.
- Deudas, presupuestos y lista de compras se identificaban por posición en el arreglo. Ahora tienen `id`, y `storage.js` migra los datos viejos al abrir la app.
- Se eliminaron `base.html` (layout viejo con el nombre "Gonzalo Pago") y las páginas `edit_*.html` que ya no se usaban (editar se hace con un modal).
- La lógica pura quedó aislada en `core.js` con 24 tests.

## Accesibilidad y móvil

- Se quitó `maximum-scale=1.0` y `user-scalable=no`, que impedían hacer zoom.
- Etiquetas `<label>` en todos los campos, `aria-label` en botones con ícono, foco visible, `aria-current` en el menú y respeto de `prefers-reduced-motion`.
- Áreas seguras de Android (`viewport-fit=cover` con `env(safe-area-inset-*)`).
- La columna de acciones de las tablas queda fija a la derecha, para llegar a editar y eliminar sin deslizar.
- Tipografía del sistema en lugar de Google Fonts (que ni siquiera se cargaba en varias páginas).

## Decisiones y lo que se dejó afuera

- **Se quitó el reordenamiento por arrastre en gastos.** Con filtros por mes y orden por fecha no tiene sentido, y evitaba depender de Sortable.
- **Tasas manuales.** Conectar una API de cotizaciones agregaría una dependencia externa y requiere conexión; queda como mejora futura.
- **Sin cifrado local.** `localStorage` no está cifrado; para datos más sensibles habría que usar almacenamiento seguro del sistema.

## Cómo se verificó

- `npm test`: 24 tests de la lógica pura.
- Pruebas de punta a punta en un navegador headless (38 pasos): carga de las 9 pantallas sin errores de JavaScript, migración de datos viejos, conversión de monedas, filtros, alta/edición/baja, intento de XSS, restauración de copias v1 y v2, vista móvil y de escritorio. Esas pruebas no se incluyen en el repositorio porque requieren Playwright.
- Prueba manual en un dispositivo Android: notificaciones de vencimiento, copias de seguridad (guardar y restaurar), gráficos y conversión de monedas.
