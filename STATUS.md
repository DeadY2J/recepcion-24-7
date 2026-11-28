# Estado · Recepción 24/7

Revisión del 27/11/2026.

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
