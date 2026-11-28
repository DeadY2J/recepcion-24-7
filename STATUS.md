# Estado · Recepción 24/7

Revisión del 27/11/2026.

## Modo presentación (28/11/2026)
- Botón «Ver la demo de 60 s»: reinicia los datos y ejecuta el guion de `PROSPECCION.md` (≈55 s) con subtítulos de la
  voz en off y una barra de seis escenas: audio de Laura, cambio de cita, hueco liberado que acepta la lista de espera,
  número nuevo que reserva y paga el anticipo de prueba, y cierre con las métricas.
- Usa la misma API que una persona (chat, estado, checkout de prueba); el motor no tiene atajos. «Detener» corta el
  guion y «Reiniciar demo» vuelve a los datos iniciales. En móvil cambia solo entre la conversación y la clínica.
- Comprobado con Playwright: 0 errores de consola, la oferta queda asignada y el anticipo aprobado al terminar.

## Rediseño visual del 28/11/2026
- Identidad propia: azul noche y menta, tono sereno. Newsreader (serif, la voz de Sofi) y Hanken Grotesk (interfaz),
  ambas OFL y alojadas en el proyecto (sin Google Fonts; la CSP no cambia).
- La conversación es la protagonista: ocupa la columna izquierda, fija al desplazarse en escritorio. Sofi habla en serif
  sobre la noche; el paciente, en burbujas claras.
- Elemento memorable: dial de 24 h con una luz por cada cita atendida por la IA (menta si la clínica estaba cerrada).
  La última cita atendida se enciende en su hora. Regla en el motor: `atencionesPorHora` y `abiertaEn` (con tests).
- La semilla reparte el historial en horas creíbles (consultas nocturnas de verdad nocturnas).
- Se quitó el voseo que quedaba en la interfaz y el checkout («Escribile», «mirá», «Escribí», «Pedile», «Revisá») y el
  test de español neutro ahora detecta formas acabadas en vocal con tilde.
- Accesibilidad: foco visible en menta, dial con descripción textual, `prefers-reduced-motion` respetado; sin desbordamiento a 390 px.

## Revisión del 28/11/2026 (auditoría fase 4)
- CSP completa con nonce por petición (`src/proxy.ts`), verificada en navegador sin errores.
- Webhook de Mercado Pago con firma `x-signature` obligatoria y comprobación del importe del anticipo.
- `verify_token` de WhatsApp comparado en tiempo constante.
- Nuevo test de español neutro sobre todos los textos de `src/`.
- Typecheck, 50 tests, build y `npm audit` (0 vulnerabilidades) en verde; axe sin incidencias en la vista inicial; sin desbordamiento a 375 px.
- Pendiente con cuentas reales (no se da por bueno): WhatsApp Cloud API y Mercado Pago con cuentas de prueba reales (firma del webhook incluida: solo está probada con firmas generadas en los tests), IA real con clave, Supabase con RLS y autenticación del panel de la clínica.
- Detalle en `AUDITORIA.md`. No desplegado.

## Hecho
- Recepcionista de WhatsApp para una clínica ficticia (Kinesio Palermo): reserva, mueve y cancela citas, cobra anticipo
  (checkout de prueba) y ofrece los huecos liberados a la lista de espera.
- Agente por reglas que funciona sin claves; agente con IA (Claude o gateway compatible con OpenAI) si hay clave.
- Textos en español neutro con tuteo. En esta revisión se cambiaron las herramientas del agente con IA de «turno» a «cita», y se quitó el voseo del README («Probala», «Abrí», «Copiá»).
- Comprobado hoy: 18 tests, typecheck, build y `npm audit` (0 vulnerabilidades) en local; CI en verde en `main`.
- `AUDITORIA.md` al día: sin críticos ni altos abiertos.

## Pendiente
- Probar con IA real (falta clave en el entorno) y con cuentas de prueba de WhatsApp Cloud API y Mercado Pago.
- Supabase con RLS en lugar del almacén en memoria; autenticación del panel de la clínica.
- Límite de peticiones compartido (ver AUDITORIA.md).
- Lighthouse en Vercel y prueba en móviles físicos (axe y emulación móvil ya hechos).
- Desplegar en Vercel y grabar el vídeo de 60 s (guion en el README). No desplegado.

## Cómo probarlo
```bash
npm ci
npm run dev        # http://localhost:3000, modo demo sin claves
npm test && npm run typecheck && npm run build
```
