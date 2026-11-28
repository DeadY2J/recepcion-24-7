/** Lo que el panel necesita ver, ya resuelto (nombres, colores, importes). */
import { ahoraNegocio, leerEstado } from "./agenda/almacen";
import { atencionesPorHora, horasDelDia, metricas, normalizarTelefono, paciente, pacientePorTelefono, servicio, turnosActivos } from "./agenda/motor";
import { TELEFONO_DEMO } from "./agenda/semilla";
import { ahoraEn, diaSemana, sumarDias } from "./agenda/tiempo";
import { modeloConfigurado } from "./agente/llm";
import { negocio } from "./negocio/config";

export type VistaPanel = ReturnType<typeof vistaPanel>;

export function vistaPanel(fechaPedida?: string, telefono: string = TELEFONO_DEMO) {
  const estado = leerEstado();
  const ahora = ahoraNegocio();
  const dias = Array.from({ length: 10 }, (_, i) => sumarDias(ahora.fecha, i)).filter((f) => horasDelDia(negocio, f).length);
  const fecha = fechaPedida && dias.includes(fechaPedida) ? fechaPedida : dias[0];
  const clave = pacientePorTelefono(estado, telefono)?.telefono ?? `+${normalizarTelefono(telefono)}`;
  const conv = estado.conversaciones[clave];

  return {
    negocio: {
      nombre: negocio.nombre,
      ciudad: negocio.ciudad,
      nombreAsistente: negocio.nombreAsistente,
      locale: negocio.locale,
      moneda: negocio.moneda,
      zonaHoraria: negocio.zonaHoraria,
      profesionales: negocio.profesionales,
    },
    motorIA: modeloConfigurado()?.nombre ?? "demo",
    ahora,
    dias,
    fecha,
    horas: horasDelDia(negocio, fecha),
    turnos: turnosActivos(estado)
      .filter((t) => t.fecha === fecha)
      .map((t) => ({
        id: t.id,
        hora: t.hora,
        profesionalId: t.profesionalId,
        paciente: paciente(estado, t.pacienteId).nombre,
        servicio: servicio(negocio, t.servicioId).nombre,
        estado: t.estado,
        origen: t.origen,
      })),
    ofertas: estado.espera
      .filter((e) => e.estado === "ofrecido" && e.oferta?.fecha === fecha)
      .map((e) => ({ hora: e.oferta!.hora, profesionalId: e.oferta!.profesionalId, paciente: paciente(estado, e.pacienteId).nombre })),
    espera: estado.espera.map((e) => ({
      id: e.id,
      paciente: paciente(estado, e.pacienteId).nombre,
      servicio: servicio(negocio, e.servicioId).nombre,
      preferencia: e.preferencia,
      estado: e.estado,
    })),
    metricas: metricas(estado, negocio, ahora),
    dial: atencionesPorHora(estado, negocio),
    horarioHoy: negocio.horarios[diaSemana(ahora.fecha)],
    /** Hora local de la última cita atendida por la IA en esta sesión (para encenderla en el dial). */
    ultimaAtencion: estado.ultimoCambio ? { ts: estado.ultimoCambio.ts, hora: Number(ahoraEn(negocio.zonaHoraria, new Date(estado.ultimoCambio.ts)).hora.slice(0, 2)) } : null,
    eventos: estado.eventos.slice(0, 25),
    ultimoCambio: estado.ultimoCambio ?? null,
    mensajes: conv?.mensajes ?? [],
    pagos: Object.fromEntries(estado.pagos.map((p) => [p.id, { monto: p.monto, estado: p.estado, url: p.url }])),
  };
}
