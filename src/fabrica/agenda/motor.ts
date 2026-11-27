/**
 * Motor de agenda: reglas de negocio puras sobre el Estado.
 * No sabe nada de WhatsApp, IA ni base de datos: por eso se puede testear
 * y reutilizar en cualquier rubro con citas (clínicas, gimnasios, barberías…).
 */
import type { ConfigNegocio } from "../negocio/config";
import type { Ahora } from "./tiempo";
import { aHora, aMinutos, diaSemana, fechaCorta, franjaDe, formatearMoneda, sumarDias } from "./tiempo";
import type { Estado, EsperaItem, Evento, Franja, Pago, Paciente, Slot, Turno, TipoEvento, OrigenTurno } from "./tipos";

/** Segundos que tarda (simulado) alguien de la lista de espera en aceptar un hueco. */
export const SEGUNDOS_ACEPTACION_ESPERA = 8;

export function nuevoId(estado: Estado, prefijo: string): string {
  estado.secuencia += 1;
  return `${prefijo}_${estado.secuencia.toString(36)}`;
}

export function registrarEvento(
  estado: Estado,
  tipo: TipoEvento,
  texto: string,
  opciones: { monto?: number; porIA?: boolean; ts?: number } = {},
): Evento {
  const evento: Evento = {
    id: nuevoId(estado, "ev"),
    ts: opciones.ts ?? Date.now(),
    tipo,
    texto,
    monto: opciones.monto,
    porIA: opciones.porIA ?? true,
  };
  estado.eventos.unshift(evento);
  if (estado.eventos.length > 300) estado.eventos.length = 300;
  return evento;
}

export function marcarCambio(estado: Estado, turno: Turno, tipo: TipoEvento) {
  estado.ultimoCambio = { turnoId: turno.id, fecha: turno.fecha, ts: Date.now(), tipo };
}

export function servicio(cfg: ConfigNegocio, id: string) {
  const s = cfg.servicios.find((x) => x.id === id);
  if (!s) throw new Error(`Servicio desconocido: ${id}`);
  return s;
}

export function profesional(cfg: ConfigNegocio, id: string) {
  const p = cfg.profesionales.find((x) => x.id === id);
  if (!p) throw new Error(`Profesional desconocido: ${id}`);
  return p;
}

export function paciente(estado: Estado, id: string): Paciente {
  const p = estado.pacientes.find((x) => x.id === id);
  if (!p) throw new Error(`Paciente desconocido: ${id}`);
  return p;
}

export function normalizarTelefono(tel: string): string {
  return tel.replace(/[^\d]/g, "");
}

export function pacientePorTelefono(estado: Estado, telefono: string): Paciente | undefined {
  const t = normalizarTelefono(telefono);
  return estado.pacientes.find((p) => normalizarTelefono(p.telefono) === t);
}

export function obtenerOCrearPaciente(estado: Estado, telefono: string, nombre?: string): Paciente {
  const existente = pacientePorTelefono(estado, telefono);
  if (existente) {
    if (nombre && existente.nombre.startsWith("Paciente ")) existente.nombre = nombre;
    return existente;
  }
  const nuevo: Paciente = {
    id: nuevoId(estado, "pac"),
    nombre: nombre ?? `Paciente ${telefono.slice(-4)}`,
    telefono,
  };
  estado.pacientes.push(nuevo);
  return nuevo;
}

export function turnosActivos(estado: Estado): Turno[] {
  return estado.turnos.filter((t) => t.estado !== "cancelado");
}

export function turnosFuturosDe(estado: Estado, pacienteId: string, ahora: Ahora): Turno[] {
  return turnosActivos(estado)
    .filter((t) => t.pacienteId === pacienteId && esFuturo(t, ahora))
    .sort(ordenSlots);
}

export function esFuturo(slot: Slot, ahora: Ahora): boolean {
  return slot.fecha > ahora.fecha || (slot.fecha === ahora.fecha && slot.hora > ahora.hora);
}

export function ordenSlots(a: Slot, b: Slot): number {
  return a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha);
}

export function slotOcupado(estado: Estado, slot: Slot): boolean {
  return turnosActivos(estado).some(
    (t) => t.fecha === slot.fecha && t.hora === slot.hora && t.profesionalId === slot.profesionalId,
  ) || estado.espera.some(
    (e) => e.estado === "ofrecido" && e.oferta && mismoSlot(e.oferta, slot),
  );
}

export function mismoSlot(a: Slot, b: Slot): boolean {
  return a.fecha === b.fecha && a.hora === b.hora && a.profesionalId === b.profesionalId;
}

export function horasDelDia(cfg: ConfigNegocio, fecha: string): string[] {
  const h = cfg.horarios[diaSemana(fecha)];
  if (!h) return [];
  const horas: string[] = [];
  for (let m = aMinutos(h.abre); m + cfg.intervaloMin <= aMinutos(h.cierra); m += cfg.intervaloMin) {
    horas.push(aHora(m));
  }
  return horas;
}

export type FiltroSlots = {
  fechas?: string[];
  franja?: Franja;
  profesionalId?: string;
  dias?: number;
  limite?: number;
  /** Evita ofrecer varias opciones a la misma hora con distintos profesionales. */
  unaPorHora?: boolean;
};

export function slotsLibres(estado: Estado, cfg: ConfigNegocio, ahora: Ahora, filtro: FiltroSlots = {}): Slot[] {
  const fechas = filtro.fechas ?? Array.from({ length: filtro.dias ?? 7 }, (_, i) => sumarDias(ahora.fecha, i));
  const libres: Slot[] = [];
  for (const fecha of fechas) {
    const vistas = new Set<string>();
    for (const hora of horasDelDia(cfg, fecha)) {
      if (filtro.franja && franjaDe(hora) !== filtro.franja) continue;
      for (const p of cfg.profesionales) {
        if (filtro.profesionalId && p.id !== filtro.profesionalId) continue;
        const slot = { fecha, hora, profesionalId: p.id };
        if (!esFuturo(slot, ahora) || slotOcupado(estado, slot)) continue;
        if (filtro.unaPorHora && vistas.has(hora)) continue;
        vistas.add(hora);
        libres.push(slot);
      }
    }
  }
  return libres.sort(ordenSlots).slice(0, filtro.limite ?? 50);
}

export function montoSena(cfg: ConfigNegocio, servicioId: string): number {
  const precio = servicio(cfg, servicioId).precio;
  return Math.round((precio * cfg.senaPorcentaje) / 100 / 100) * 100;
}

export function crearPago(estado: Estado, cfg: ConfigNegocio, turno: Turno): Pago {
  // Id impredecible: el link de pago se comparte por WhatsApp y no debe poder adivinarse.
  const id = `pago_${crypto.randomUUID()}`;
  const pago: Pago = {
    id,
    turnoId: turno.id,
    monto: montoSena(cfg, turno.servicioId),
    estado: "pendiente",
    proveedor: "demo",
    url: `/pago/${id}`,
  };
  estado.pagos.push(pago);
  return pago;
}

export function reservar(
  estado: Estado,
  cfg: ConfigNegocio,
  ahora: Ahora,
  datos: { pacienteId: string; slot: Slot; servicioId: string; origen?: OrigenTurno; conSena?: boolean },
): { turno: Turno; pago?: Pago } {
  servicio(cfg, datos.servicioId);
  profesional(cfg, datos.slot.profesionalId);
  if (!horasDelDia(cfg, datos.slot.fecha).includes(datos.slot.hora)) {
    throw new Error("Ese horario está fuera del horario de atención.");
  }
  if (!esFuturo(datos.slot, ahora)) throw new Error("Ese horario ya pasó.");
  if (slotOcupado(estado, datos.slot)) throw new Error("Ese horario ya está ocupado.");

  const conSena = datos.conSena ?? true;
  const turno: Turno = {
    ...datos.slot,
    id: nuevoId(estado, "tur"),
    pacienteId: datos.pacienteId,
    servicioId: datos.servicioId,
    estado: conSena ? "pendiente_sena" : "confirmado",
    senaPagada: false,
    origen: datos.origen ?? "ia",
    creadoEn: Date.now(),
  };
  estado.turnos.push(turno);
  const pac = paciente(estado, datos.pacienteId);
  registrarEvento(
    estado,
    "turno_reservado",
    `${pac.nombre} reservó ${servicio(cfg, datos.servicioId).nombre} el ${fechaCorta(turno.fecha)} a las ${turno.hora} con ${profesional(cfg, turno.profesionalId).nombre}`,
    { porIA: turno.origen !== "recepcion" },
  );
  marcarCambio(estado, turno, "turno_reservado");
  return { turno, pago: conSena ? crearPago(estado, cfg, turno) : undefined };
}

export function mover(estado: Estado, cfg: ConfigNegocio, ahora: Ahora, turnoId: string, destino: Slot): Turno {
  const turno = estado.turnos.find((t) => t.id === turnoId && t.estado !== "cancelado");
  if (!turno) throw new Error("No encontré esa cita.");
  if (!esFuturo(destino, ahora)) throw new Error("Ese horario ya pasó.");
  if (!horasDelDia(cfg, destino.fecha).includes(destino.hora)) {
    throw new Error("Ese horario está fuera del horario de atención.");
  }
  if (slotOcupado(estado, destino)) throw new Error("Ese horario ya está ocupado.");
  const origen: Slot = { fecha: turno.fecha, hora: turno.hora, profesionalId: turno.profesionalId };
  Object.assign(turno, destino);
  const pac = paciente(estado, turno.pacienteId);
  registrarEvento(
    estado,
    "turno_movido",
    `${pac.nombre} pasó su cita del ${fechaCorta(origen.fecha)} ${origen.hora} al ${fechaCorta(destino.fecha)} ${destino.hora}`,
  );
  marcarCambio(estado, turno, "turno_movido");
  ofrecerHuecoAListaDeEspera(estado, cfg, ahora, origen);
  return turno;
}

export function cancelar(estado: Estado, cfg: ConfigNegocio, ahora: Ahora, turnoId: string): Turno {
  const turno = estado.turnos.find((t) => t.id === turnoId && t.estado !== "cancelado");
  if (!turno) throw new Error("No encontré esa cita.");
  turno.estado = "cancelado";
  const pac = paciente(estado, turno.pacienteId);
  marcarCambio(estado, turno, "turno_cancelado");
  registrarEvento(estado, "turno_cancelado", `${pac.nombre} canceló su cita del ${fechaCorta(turno.fecha)} ${turno.hora}`);
  ofrecerHuecoAListaDeEspera(estado, cfg, ahora, turno);
  return turno;
}

/**
 * "Mata-ausencias": cuando se libera un hueco, se lo ofrece por WhatsApp
 * a la primera persona de la lista de espera que encaja con esa franja.
 */
export function ofrecerHuecoAListaDeEspera(
  estado: Estado,
  cfg: ConfigNegocio,
  ahora: Ahora,
  slot: Slot,
  ts: number = Date.now(),
): EsperaItem | undefined {
  if (!esFuturo(slot, ahora) || slotOcupado(estado, slot)) return undefined;
  const franja = franjaDe(slot.hora);
  const candidato = estado.espera.find(
    (e) => e.estado === "esperando" && (e.preferencia === "cualquiera" || e.preferencia === franja),
  );
  if (!candidato) return undefined;
  candidato.estado = "ofrecido";
  candidato.oferta = { ...slot };
  candidato.ofrecidoEn = ts;
  const pac = paciente(estado, candidato.pacienteId);
  registrarEvento(
    estado,
    "hueco_ofrecido",
    `Hueco del ${fechaCorta(slot.fecha)} ${slot.hora} ofrecido por WhatsApp a ${pac.nombre} (lista de espera)`,
    { ts },
  );
  return candidato;
}

/** Acepta las ofertas de la lista de espera que ya "respondieron" (simulado en la demo). */
export function resolverOfertasPendientes(estado: Estado, cfg: ConfigNegocio, ahoraMs: number = Date.now()): Turno[] {
  const nuevos: Turno[] = [];
  for (const item of estado.espera) {
    if (item.estado !== "ofrecido" || !item.oferta || !item.ofrecidoEn) continue;
    if (ahoraMs - item.ofrecidoEn < SEGUNDOS_ACEPTACION_ESPERA * 1000) continue;
    nuevos.push(aceptarOferta(estado, cfg, item.id, ahoraMs));
  }
  return nuevos;
}

export function aceptarOferta(estado: Estado, cfg: ConfigNegocio, esperaId: string, ts: number = Date.now()): Turno {
  const item = estado.espera.find((e) => e.id === esperaId);
  if (!item || item.estado !== "ofrecido" || !item.oferta) throw new Error("No hay oferta pendiente.");
  const slot = item.oferta;
  item.estado = "asignado";
  item.oferta = undefined;
  const turno: Turno = {
    ...slot,
    id: nuevoId(estado, "tur"),
    pacienteId: item.pacienteId,
    servicioId: item.servicioId,
    estado: "confirmado",
    senaPagada: false,
    origen: "lista_espera",
    creadoEn: ts,
  };
  estado.turnos.push(turno);
  const precio = servicio(cfg, item.servicioId).precio;
  registrarEvento(
    estado,
    "hueco_recuperado",
    `${paciente(estado, item.pacienteId).nombre} aceptó el hueco del ${fechaCorta(slot.fecha)} ${slot.hora}: ${formatearMoneda(precio, cfg.locale, cfg.moneda)} recuperados`,
    { monto: precio, ts },
  );
  marcarCambio(estado, turno, "hueco_recuperado");
  return turno;
}

export function aprobarPago(estado: Estado, cfg: ConfigNegocio, pagoId: string): Pago {
  const pago = estado.pagos.find((p) => p.id === pagoId);
  if (!pago) throw new Error("Pago no encontrado.");
  if (pago.estado === "aprobado") return pago;
  pago.estado = "aprobado";
  const turno = estado.turnos.find((t) => t.id === pago.turnoId);
  if (turno && turno.estado !== "cancelado") {
    turno.senaPagada = true;
    turno.estado = "confirmado";
  }
  const nombre = turno ? paciente(estado, turno.pacienteId).nombre : "Paciente";
  registrarEvento(estado, "sena_cobrada", `Anticipo de ${nombre} cobrado: ${formatearMoneda(pago.monto, cfg.locale, cfg.moneda)}`, {
    monto: pago.monto,
  });
  return pago;
}

export type Metricas = {
  turnosPorIA: number;
  huecosRecuperados: number;
  dineroRecuperado: number;
  senasCobradas: number;
  dineroSenas: number;
  fueraDeHorario: number;
  ocupacionHoy: number;
};

export function metricas(estado: Estado, cfg: ConfigNegocio, ahora: Ahora): Metricas {
  // En la demo el historial empieza a principios de mes, así que contamos todo.
  const delMes = estado.eventos;
  const sumar = (tipo: TipoEvento) => delMes.filter((e) => e.tipo === tipo).reduce((s, e) => s + (e.monto ?? 0), 0);
  const contar = (tipo: TipoEvento) => delMes.filter((e) => e.tipo === tipo).length;
  const horasHoy = horasDelDia(cfg, ahora.fecha).length * cfg.profesionales.length;
  const ocupadosHoy = turnosActivos(estado).filter((t) => t.fecha === ahora.fecha).length;
  return {
    turnosPorIA: delMes.filter((e) => (e.tipo === "turno_reservado" || e.tipo === "turno_movido") && e.porIA).length,
    huecosRecuperados: contar("hueco_recuperado"),
    dineroRecuperado: sumar("hueco_recuperado"),
    senasCobradas: contar("sena_cobrada"),
    dineroSenas: sumar("sena_cobrada"),
    fueraDeHorario: contar("mensaje_fuera_de_horario"),
    ocupacionHoy: horasHoy ? Math.round((ocupadosHoy / horasHoy) * 100) : 0,
  };
}
