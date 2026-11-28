# Presupuesto · Recepción 24/7

Fase 5 del flujo de la Fábrica. Plantilla para un cliente propio: una clínica que quiere su recepcionista con IA
en producción. Las tarifas quedan sin rellenar a propósito.

- Tarifa por hora: **[TARIFA_HORA_USD]** USD
- Cuota mensual de mantenimiento: **[CUOTA_MENSUAL_USD]** USD
- Moneda local del cliente: convertir al tipo de cambio del día de emisión e indicar la fecha del cambio.

## 1. Adaptación y puesta en producción

La demo ya existe; al cliente se le cobra adaptarla y dejarla funcionando con sus datos.

| Tarea | Horas |
|---|---|
| Configuración de la clínica (servicios, profesionales, horarios, anticipos, tono) | 2 |
| Persistencia en Supabase con RLS por clínica | 8 |
| Inicio de sesión del panel para la clínica | 4 |
| Alta en WhatsApp Cloud API, plantillas aprobadas y pruebas | 4 |
| Mercado Pago real: cuenta del cliente, firma del webhook y pruebas | 3 |
| Seguridad de producción: CSP con nonces y límite de peticiones compartido | 3 |
| Despliegue en Vercel con dominio | 2 |
| Pruebas con la clínica y ajustes | 4 |
| **Total** | **30 h** |

**Importe de implementación** = 30 h × [TARIFA_HORA_USD] = ____ USD (≈ ____ en moneda local).

## 2. Mantenimiento mensual

[CUOTA_MENSUAL_USD] USD al mes. Incluye: alojamiento gestionado, actualizaciones de seguridad, copias de seguridad,
cambios menores de configuración (horarios, servicios, precios) y soporte por WhatsApp en horario laboral.
No incluye funciones nuevas: se presupuestan aparte.

## 3. Costes de terceros (los paga el cliente, según la tarifa vigente de cada proveedor)

- WhatsApp Cloud API (Meta): cobro por conversación según país y tipo de plantilla.
- Mercado Pago: comisión por cobro.
- IA (Claude u otro modelo): consumo por mensaje; el agente por reglas no tiene coste.
- Supabase y Vercel: planes gratuitos al principio; de pago si crece el volumen.

## Condiciones

- 50 % al aceptar y 50 % a la entrega. Garantía de 30 días sobre lo entregado.
- Validez del presupuesto: 15 días.

## Si llega por Kodarvia

El precio lo fija Kodarvia. Comparar su pago con las 30 h de la tabla: si el pago por hora resultante queda por debajo
de [TARIFA_HORA_USD], no compensa. Recordar sus condiciones: cesión total del código, 30 días de garantía y no captar
al cliente final durante 12 meses.
