# Auditoría · Recepción 24/7

Fecha: 27/11/2026 · Alcance: repositorio `recepcion-24-7` (Next.js 16, almacén en memoria, WhatsApp y Mercado Pago sin cuentas reales).
Metodología: revisión de código de todas las rutas API y módulos de integración, más comprobaciones ejecutadas (typecheck, tests, build, `npm audit`, cabeceras y límite de peticiones contra `next start`).

## Resultado

Sin fallos críticos ni altos abiertos. Los 2 críticos/altos encontrados se corrigieron en esta misma pasada y tienen test. Quedan puntos medios/bajos documentados abajo.

## Seguridad

| # | Gravedad | Hallazgo | Estado |
|---|----------|----------|--------|
| S1 | Alta | `/api/chat`, `/api/estado` y `/api/demo/reiniciar` aceptan cualquier teléfono sin autenticación. Con WhatsApp real activado, cualquiera podría escribir como otro paciente (cancelar su cita), leer su conversación o reiniciar los datos. | **Corregido**: los tres endpoints devuelven 404 si hay WhatsApp o Mercado Pago configurados (`modoDemo()` en `src/fabrica/seguridad.ts`); `DEMO_PUBLICA=1` los reactiva a propósito. Test incluido. |
| S2 | Alta | Los ids de pago eran secuenciales (`pago_1a`, `pago_1b`…): `/api/pagos/[id]` revelaba nombre, servicio y hora de otros pacientes y permitía marcar pagos ajenos como pagados en el checkout de prueba (IDOR). | **Corregido**: ids con `crypto.randomUUID()`. Test incluido. |
| S3 | Media | `/api/chat` sin límite de peticiones: con `ANTHROPIC_API_KEY` configurada, abuso = coste ilimitado de IA. | **Corregido**: 20 mensajes/min por IP en chat y 5/min en reinicio (verificado: la petición 21 devuelve 429). Límite en memoria; en producción con varias instancias hace falta uno compartido (Upstash/Redis). |
| S4 | Media | Webhook de WhatsApp: Meta reintenta entregas y se respondía dos veces; JSON inválido o fallo de envío daban 500 y más reintentos. | **Corregido**: dedupe por id de mensaje, 400 ante JSON inválido, error de envío capturado. El dedupe es por instancia; con BD debe persistirse. |
| S5 | Media | Faltaban cabeceras de seguridad. | **Corregido** en `next.config.ts`: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS, CSP mínima (frame-ancestors, base-uri, form-action, object-src) y sin `X-Powered-By`. Verificado con `curl -I`. |
| S6 | Media | CSP completa (script-src/style-src) no aplicada: Next.js necesita nonces para scripts en línea. | Abierto, pendiente antes de producción real. |
| S7 | Media | El checkout de prueba (`POST /api/pagos/[id]`) marca pagado a quien conozca el id. Es intencional en la demo; se desactiva solo con `MERCADOPAGO_ACCESS_TOKEN`. | Aceptado para la demo. No desplegar en producción sin ese token. |
| S8 | Baja | El webhook de Mercado Pago no valida `x-signature`; mitigado porque nunca se confía en el cuerpo y se consulta el pago a la API oficial. | Abierto (mejora). Añadir validación de firma y comprobar que el monto coincide con el del anticipo. |
| S9 | Baja | La comparación del `verify_token` de WhatsApp (GET) no es de tiempo constante. | Abierto (riesgo mínimo). |
| S10 | Baja | Estado y mensajes en memoria sin tope: un atacante podría inflar la memoria. Mitigado por el límite de peticiones. | Abierto; se resuelve al pasar a Supabase. |

Comprobado sin hallazgos:
- **Validación de entradas**: `/api/chat` valida con Zod (teléfono 6–25, texto 1–1000, audio 1–300 s). Webhooks validan firma antes de parsear.
- **Permisos**: un paciente solo toca sus citas (`propioTurno`), cubierto por test («solo puede cancelar sus propias citas»).
- **Secretos**: ninguno en el código; `.env.example` sin valores; `.gitignore` excluye `.env` y `.env*.local`.
- **Webhook de WhatsApp**: HMAC SHA-256 con `timingSafeEqual`; sin `WHATSAPP_APP_SECRET` rechaza todo (test incluido).
- **Dependencias**: `npm audit` → 0 vulnerabilidades.

## Calidad

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm test` | OK · 18 tests (motor, agente demo, seguridad) |
| `npm run build` | OK · 7 rutas |
| CI | `.github/workflows/ci.yml` (typecheck, test, build). En verde en `main` (GitHub Actions, 27/11/2026). |
| Textos | Todo el texto visible en español neutro con tuteo; hay un test que comprueba que las respuestas ante modismos de varios países no llevan voseo, «turno» ni «seña». Revisión 27/11/2026: las herramientas del agente con IA y sus descripciones decían «turno» (el modelo podía repetirlo); renombradas a `reservar_cita`, `mover_cita` y `cancelar_cita`. |
| Accesibilidad (revisión de código, no medida) | `lang="es"`, `aria-label` en botones de icono, `aria-live` en el chat, `role="tab"`/`aria-selected` en pestañas, emojis decorativos con `aria-hidden`. **No medido**: contraste de la paleta jacarandá/verde y navegación por teclado; falta pasar Lighthouse/axe. |
| Rendimiento | Sin medir con Lighthouse. Fuente alojada en local (sin Google Fonts); el panel hace polling cada 2,5 s: aceptable en demo, sustituir por SSE/websocket en producción. |
| Móvil | Layout con pestañas «WhatsApp / Agenda» por debajo de `lg`. Sin probar en dispositivo real. |

## Pendiente antes de producción real
1. Medir accesibilidad y rendimiento (Lighthouse/axe) y probar en móvil.
2. CSP completa con nonces (S6), límite de peticiones compartido (S3) y firma de Mercado Pago (S8).
3. Sustituir el almacén en memoria por Supabase con RLS por negocio.
4. Autenticación para el panel de la clínica (hoy es solo de demo).
