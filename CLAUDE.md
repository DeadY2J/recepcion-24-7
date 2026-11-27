# Fábrica · Recepción 24/7

Proyecto de Jorge Lamelas: base reutilizable ("Fábrica") para software de pymes de Latinoamérica.
Primera demo: recepcionista con IA por WhatsApp para una clínica de kinesiología ficticia (Kinesio Palermo, Buenos Aires).

## Comandos
- `npm run dev`: servidor en http://localhost:3000
- `npm test`: tests (Vitest). Deben pasar siempre antes de commitear.
- `npm run typecheck` y `npm run build`: los ejecuta también la CI.

## Arquitectura (respétala)
- `src/fabrica/negocio/config.ts`: lo ÚNICO que cambia por cliente (servicios, profesionales, horarios, tono).
- `src/fabrica/agenda/`: motor de turnos puro y testeable. Sin dependencias de IA ni de UI.
- `src/fabrica/agente/`: `herramientas.ts` (acciones de negocio), `demo.ts` (agente por reglas, sin API key),
  `llm.ts` (agente con Claude u otro modelo vía AI SDK), `index.ts` (orquesta la conversación).
- `src/fabrica/pagos/`, `src/fabrica/whatsapp/`: integraciones reales que solo se activan con variables de entorno.
- `src/app/`: interfaz (sala de demo, checkout de prueba) y rutas API.

## Convenciones
- Código y comentarios en español. Todos los textos visibles (interfaz, agente, mensajes) van en español latinoamericano neutro con tuteo: sin voseo ni modismos regionales, con palabras comprensibles en todos los países ("cita", no "turno"; "anticipo", no "seña"). El agente debe ENTENDER cualquier acento o modismo del paciente, pero RESPONDER siempre en neutro. Los mensajes de ejemplo del paciente en el guion pueden llevar modismos.
- Toda regla de negocio nueva va en el motor con su test, no en la UI ni en el prompt.
- Un paciente solo puede tocar sus propios turnos (ver `propioTurno` en herramientas.ts).
- El almacén es en memoria para la demo; para producción se sustituye `agenda/almacen.ts` por Supabase sin tocar el motor.
