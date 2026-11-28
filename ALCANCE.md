# Alcance · Recepción 24/7

Fase 1 del flujo de la Fábrica. Escrito el 27/11/2026, después de construir la demo: documenta lo que ya existe
y lo que falta para un cliente real.

## Problema del negocio

Las clínicas pequeñas (kinesiología, fisioterapia, odontología, psicología) reciben casi todas las citas por WhatsApp.
Nadie contesta fuera de horario, la recepcionista pasa el día con el móvil y cada ausencia es una hora perdida que nadie
vuelve a ocupar. Recepción 24/7 responde al instante, gestiona las citas sola y rellena los huecos con la lista de espera.

## Usuarios

- **Paciente**: escribe o manda un audio por WhatsApp para reservar, mover o cancelar su cita.
- **Clínica (recepción y dueño)**: mira la agenda y las métricas en el panel; ya no tiene que contestar cada mensaje.

## Funcionalidades del MVP (hechas)

1. Agente por WhatsApp que reserva, mueve y cancela citas, también a partir de audios (transcritos).
2. Lista de espera: cuando se libera un hueco, se ofrece al primero de la lista y se registra el dinero recuperado.
3. Anticipo para confirmar la cita (Mercado Pago; en la demo, checkout de prueba claramente marcado).
4. Panel de la clínica con agenda, eventos y métricas del mes.
5. Modo demo sin claves: agente por reglas que entiende modismos de varios países y responde en español neutro.
6. Agente con IA opcional (Claude o gateway compatible con OpenAI) con las mismas herramientas y el mismo motor.

## Fase 2

- Persistencia en Supabase con RLS por clínica; autenticación del panel.
- Recordatorios automáticos el día anterior (plantilla aprobada de WhatsApp).
- Varias sedes y agenda por sala o camilla.
- Respuestas a reseñas de Google.

## Criterios de aceptación

- Un paciente solo puede ver, mover o cancelar sus propias citas (test `propioTurno`).
- Nunca se reserva fuera de horario ni sobre una cita existente (tests del motor).
- Las respuestas al paciente no llevan voseo, «turno» ni «seña» (test con modismos de varios países).
- Sin claves, la sala de demo funciona de principio a fin en menos de un minuto.
- Typecheck, tests y build en verde en la CI.

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| WhatsApp Cloud API solo permite plantillas aprobadas fuera de la ventana de 24 h | Medio | Recordatorios y ofertas de hueco con plantillas; el resto, dentro de la conversación abierta. |
| El modelo de IA se equivoca o inventa horarios | Alto | El modelo solo actúa con herramientas del motor; si falla, sigue el agente por reglas. |
| Coste de IA por abuso | Medio | Límite de peticiones; hace falta uno compartido en producción. |
| Datos de salud de pacientes | Alto | Guardar lo mínimo (nombre, teléfono, cita); nada clínico. Revisar la ley local de datos personales. |

## Estimación (demo construida)

| Parte | Horas |
|---|---|
| Base del repo, configuración por negocio y CI | 2 |
| Motor de citas, anticipos y lista de espera con tests | 7 |
| Agente demo por reglas (modismos, audios) con tests | 5 |
| Agente con IA y herramientas | 4 |
| Integraciones WhatsApp y Mercado Pago | 6 |
| Interfaz (sala de demo, panel, checkout de prueba) | 6 |
| Auditoría, español neutro y README | 3 |
| **Total** | **33** |

Estimación hecha a posteriori, sin registro de horas reales.
