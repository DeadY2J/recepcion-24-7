/**
 * Herramientas del asistente. Las usan tanto el agente con LLM (Claude u otro
 * modelo) como el agente demo sin conexión, así que el comportamiento de negocio
 * es idéntico en ambos casos.
 */
import type { ConfigNegocio } from "../negocio/config";
import * as motor from "../agenda/motor";
import type { Ahora } from "../agenda/tiempo";
import { fechaCorta, formatearMoneda } from "../agenda/tiempo";
import type { Estado, Franja, Pago, Slot, Turno } from "../agenda/tipos";

export type Contexto = {
  estado: Estado;
  cfg: ConfigNegocio;
  ahora: Ahora;
  telefono: string;
  /** Se rellena si durante el turno de conversación se generó un link de pago. */
  pagoGenerado?: Pago;
  acciones: string[];
};

export function describirSlot(cfg: ConfigNegocio, s: Slot): string {
  return `${fechaCorta(s.fecha)} a las ${s.hora} con ${motor.profesional(cfg, s.profesionalId).nombre}`;
}

export function describirTurno(cfg: ConfigNegocio, t: Turno): string {
  return `${motor.servicio(cfg, t.servicioId).nombre}, ${describirSlot(cfg, t)}`;
}

export function misTurnos(ctx: Contexto) {
  const pac = motor.pacientePorTelefono(ctx.estado, ctx.telefono);
  if (!pac) return { paciente: null, turnos: [] as Turno[] };
  return { paciente: pac, turnos: motor.turnosFuturosDe(ctx.estado, pac.id, ctx.ahora) };
}

export function buscarHorarios(
  ctx: Contexto,
  filtro: { fechas?: string[]; franja?: Franja; profesionalId?: string; hora?: string; limite?: number },
): Slot[] {
  let slots = motor.slotsLibres(ctx.estado, ctx.cfg, ctx.ahora, {
    fechas: filtro.fechas,
    franja: filtro.franja,
    profesionalId: filtro.profesionalId,
    dias: 10,
    unaPorHora: !filtro.profesionalId,
    limite: 200,
  });
  if (filtro.hora) {
    const exactos = slots.filter((s) => s.hora === filtro.hora);
    if (exactos.length) slots = exactos;
  }
  return slots.slice(0, filtro.limite ?? 3);
}

export function reservarTurno(
  ctx: Contexto,
  datos: { slot: Slot; servicioId: string; nombre?: string },
): { turno: Turno; pago?: Pago } {
  const pac = motor.obtenerOCrearPaciente(ctx.estado, ctx.telefono, datos.nombre);
  const r = motor.reservar(ctx.estado, ctx.cfg, ctx.ahora, {
    pacienteId: pac.id,
    slot: datos.slot,
    servicioId: datos.servicioId,
    origen: "ia",
  });
  if (r.pago) ctx.pagoGenerado = r.pago;
  ctx.acciones.push(`Reservó: ${describirTurno(ctx.cfg, r.turno)}`);
  return r;
}

export function moverTurno(ctx: Contexto, turnoId: string, destino: Slot): Turno {
  propioTurno(ctx, turnoId);
  const t = motor.mover(ctx.estado, ctx.cfg, ctx.ahora, turnoId, destino);
  ctx.acciones.push(`Movió cita a ${describirSlot(ctx.cfg, destino)}`);
  return t;
}

export function cancelarTurno(ctx: Contexto, turnoId: string): Turno {
  propioTurno(ctx, turnoId);
  const t = motor.cancelar(ctx.estado, ctx.cfg, ctx.ahora, turnoId);
  ctx.acciones.push(`Canceló cita del ${fechaCorta(t.fecha)} ${t.hora}`);
  return t;
}

/** Seguridad: un paciente solo puede tocar sus propios turnos. */
function propioTurno(ctx: Contexto, turnoId: string) {
  const { turnos } = misTurnos(ctx);
  if (!turnos.some((t) => t.id === turnoId)) throw new Error("Esa cita no pertenece a este número.");
}

export function infoNegocio(cfg: ConfigNegocio) {
  return {
    nombre: cfg.nombre,
    direccion: cfg.direccion,
    obrasSociales: cfg.obrasSociales,
    senaPorcentaje: cfg.senaPorcentaje,
    servicios: cfg.servicios.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      duracionMin: s.duracionMin,
      precio: formatearMoneda(s.precio, cfg.locale, cfg.moneda),
      sena: formatearMoneda(motor.montoSena(cfg, s.id), cfg.locale, cfg.moneda),
      descripcion: s.descripcion,
    })),
    profesionales: cfg.profesionales.map((p) => ({ id: p.id, nombre: p.nombre, especialidad: p.especialidad })),
  };
}
