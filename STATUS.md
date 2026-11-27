# Estado · Recepción 24/7

Revisión del 27/11/2026.

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
- CSP completa con nonces, límite de peticiones compartido y firma del webhook de Mercado Pago (ver AUDITORIA.md).
- Medir accesibilidad y rendimiento (Lighthouse/axe) y probar en móvil.
- Desplegar en Vercel y grabar el vídeo de 60 s (guion en el README). No desplegado.

## Cómo probarlo
```bash
npm ci
npm run dev        # http://localhost:3000, modo demo sin claves
npm test && npm run typecheck && npm run build
```
