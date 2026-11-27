/**
 * Agente demo sin conexión: entiende el español coloquial de cualquier país de
 * Latinoamérica que use un paciente por WhatsApp (modismos incluidos) con reglas,
 * pero responde siempre en español neutro con tuteo. Permite enseñar la demo sin API key ni
 * internet. Con ANTHROPIC_API_KEY (u otro proveedor) se usa el agente LLM.
 */
import * as motor from "../agenda/motor";
import { diaSemana, fechaCorta, franjaDe, formatearMoneda, sumarDias } from "../agenda/tiempo";
import type { Franja, Slot } from "../agenda/tipos";
import type { Contexto } from "./herramientas";
import { buscarHorarios, cancelarTurno, describirSlot, infoNegocio, misTurnos, moverTurno, reservarTurno } from "./herramientas";

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const NUMEROS = ["1️⃣", "2️⃣", "3️⃣"];

export function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Días mencionados, en orden de aparición, como fechas concretas. */
export function detectarFechas(texto: string, hoy: string): string[] {
  const t = normalizar(texto);
  const encontrados: Array<{ pos: number; fecha: string }> = [];
  const hoyPos = t.search(/\bhoy\b/);
  if (hoyPos >= 0) encontrados.push({ pos: hoyPos, fecha: hoy });
  const pasado = t.search(/\bpasado manana\b/);
  if (pasado >= 0) encontrados.push({ pos: pasado, fecha: sumarDias(hoy, 2) });
  const re = /\bmanana\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const antes = t.slice(Math.max(0, m.index - 8), m.index);
    if (/(la|por la|a la|de la|pasado) $/.test(antes)) continue; // "a la mañana" = franja
    encontrados.push({ pos: m.index, fecha: sumarDias(hoy, 1) });
  }
  DIAS.forEach((dia, idx) => {
    const r = new RegExp(`\\b${dia}\\b`, "g");
    let x: RegExpExecArray | null;
    while ((x = r.exec(t))) {
      let fecha = hoy;
      for (let i = 0; i < 7; i++) {
        const f = sumarDias(hoy, i);
        if (diaSemana(f) === idx) {
          fecha = f;
          break;
        }
      }
      encontrados.push({ pos: x.index, fecha });
    }
  });
  return encontrados.sort((a, b) => a.pos - b.pos).map((e) => e.fecha);
}

export function detectarFranja(texto: string): Franja | undefined {
  const t = normalizar(texto);
  if (/\b(tarde|tardecita|despues del almuerzo|siesta)\b/.test(t)) return "tarde";
  if (/\b(la manana|temprano|mediodia)\b/.test(t)) return "mañana";
  if (/\bnoche\b/.test(t)) return "tarde";
  return undefined;
}

export function detectarHora(texto: string): string | undefined {
  const t = normalizar(texto);
  const m =
    t.match(/\b(?:a las|las|tipo|a eso de las|para las)\s+(\d{1,2})(?::(\d{2}))?\b/) ??
    t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:hs|h|horas)\b/) ??
    t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return undefined;
  let h = Number(m[1]);
  if (h < 8 || /\bde la tarde\b/.test(t)) h = h < 12 ? h + 12 : h;
  if (h > 23) return undefined;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

export function detectarOpcion(texto: string, cantidad: number): number | undefined {
  const t = normalizar(texto);
  const ordinales: Array<[RegExp, number]> = [
    [/\b(primera|primero|uno)\b/, 0],
    [/\b(segunda|segundo|dos)\b/, 1],
    [/\b(tercera|tercero|tres)\b/, 2],
  ];
  for (const [re, i] of ordinales) if (re.test(t) && i < cantidad) return i;
  const n = t.match(/^(?:la |el |opcion |la opcion )?([1-9])$/) ?? t.match(/\bopcion ([1-9])\b/);
  if (n) {
    const i = Number(n[1]) - 1;
    if (i < cantidad) return i;
  }
  return undefined;
}

export function detectarServicio(texto: string): string | undefined {
  const t = normalizar(texto);
  if (/\b(rpg|postura|postural|espalda|cervical|columna)\b/.test(t)) return "rpg";
  if (/\b(deportiva|evaluacion|corro|running|corredor|maraton|futbol)\b/.test(t)) return "deportiva";
  if (/\b(kine|kinesio|kinesiologia|rodilla|tobillo|hombro|esguince|contractura|lesion)\b/.test(t)) return "kine";
  return undefined;
}

const es = (re: RegExp, t: string) => re.test(t);

export function responderDemo(ctx: Contexto, texto: string): string {
  const t = normalizar(texto);
  const conv = ctx.estado.conversaciones[ctx.telefono];
  const memoria = conv?.memoria ?? {};
  const { paciente, turnos } = misTurnos(ctx);
  const nombre = paciente && !paciente.nombre.startsWith("Paciente ") ? paciente.nombre.split(" ")[0] : undefined;
  const cfg = ctx.cfg;
  const fechas = detectarFechas(texto, ctx.ahora.fecha);
  const franja = detectarFranja(texto);
  const hora = detectarHora(texto);

  const quiereCancelar = es(/\b(cancelar|cancela|cancelo|no (voy a )?(poder|puedo) ir|anular|suspender)\b/, t);
  const quiereMover = es(/\b(pasar|pasame|pasarlo|cambiar|cambiame|mover|moverlo|reprogramar|correr|corre|correrlo)\b/, t);
  const quiereTurno = es(/\b(turno|reservar|reserva|sacar|agendar|lugar|disponib|hueco|atender|atienden|sesion|cita)\b/, t);
  const confirma = es(/^(si|sii+|dale|perfecto|ok|okey|joya|genial|de una|listo|buenisimo|va)\b/, t);

  // 0) Número nuevo que acaba de decir su nombre para cerrar la reserva.
  if (memoria.esperandoNombre && !quiereCancelar) {
    const nombreDicho = extraerNombre(texto);
    if (!nombreDicho) return "Perdón, no te entendí 🙈 ¿A nombre de quién dejo la cita? (nombre y apellido)";
    const { slot, servicioId } = memoria.esperandoNombre;
    limpiarMemoria(ctx);
    return confirmarReserva(ctx, slot, servicioId, nombreDicho);
  }

  // 1) Elección entre opciones ofrecidas antes.
  if (memoria.ofrecidos?.length && !quiereCancelar) {
    let idx = detectarOpcion(texto, memoria.ofrecidos.length);
    if (idx === undefined && hora) idx = memoria.ofrecidos.findIndex((s) => s.hora === hora);
    if ((idx === undefined || idx < 0) && confirma) idx = 0;
    if (idx !== undefined && idx >= 0) {
      const elegido = memoria.ofrecidos[idx];
      const accion = memoria.accion;
      const turnoAMover = memoria.turnoAMoverId;
      const servicioId = memoria.servicioId ?? "kine";
      limpiarMemoria(ctx);
      try {
        if (accion === "mover" && turnoAMover) {
          moverTurno(ctx, turnoAMover, elegido);
          return `¡Listo${nombre ? `, ${nombre}` : ""}! ✅ Te pasé la cita al *${describirSlot(cfg, elegido)}*. Tu anticipo sigue valiendo, no tienes que pagar nada de nuevo.\n\nEl día anterior te envío un recordatorio. ¡Nos vemos!`;
        }
        if (!paciente) {
          if (motor.slotOcupado(ctx.estado, elegido)) throw new Error("");
          guardarMemoria(ctx, { esperandoNombre: { slot: elegido, servicioId } });
          return `¡Perfecto! Te guardo el *${describirSlot(cfg, elegido)}* 🙌 ¿A nombre de quién la dejo? (nombre y apellido)`;
        }
        return confirmarReserva(ctx, elegido, servicioId);
      } catch (e) {
        return `Ese horario se acaba de ocupar 😅 ${(e as Error).message} ¿Te busco otro?`;
      }
    }
  }

  // 2) Cancelar.
  if (quiereCancelar) {
    const turno = elegirTurno(turnos, fechas);
    if (!turno) return `No encuentro citas a tu nombre${nombre ? `, ${nombre}` : ""}. ¿Quieres que te reserve una?`;
    cancelarTurno(ctx, turno.id);
    limpiarMemoria(ctx);
    return `Listo, cancelé tu cita del *${describirSlot(cfg, turno)}*. Gracias por avisar con tiempo 🙏 Ese lugar ya se lo estoy ofreciendo a alguien de la lista de espera.\n\n¿Quieres que te busque otro día?`;
  }

  // 3) Mover un turno existente.
  if (quiereMover && turnos.length) {
    const turno = elegirTurno(turnos, fechas);
    if (turno) {
      const destinoFechas = fechas.length >= 2 ? [fechas[fechas.length - 1]] : fechas.length === 1 ? [fechas[0]] : undefined;
      const opciones = buscarHorarios(ctx, {
        fechas: destinoFechas,
        franja: franja ?? (hora ? franjaDe(hora) : undefined),
        hora,
        limite: 3,
      }).filter((s) => !(s.fecha === turno.fecha && s.hora === turno.hora));
      if (hora && opciones[0]?.hora === hora && (!destinoFechas || opciones[0].fecha === destinoFechas[0])) {
        moverTurno(ctx, turno.id, opciones[0]);
        limpiarMemoria(ctx);
        return `¡Hecho${nombre ? `, ${nombre}` : ""}! ✅ Tu cita quedó para el *${describirSlot(cfg, opciones[0])}*.`;
      }
      if (!opciones.length) {
        return `Para ese momento no me quedan lugares 😕 ¿Te sirve otro día? Dime cuál y te paso opciones.`;
      }
      guardarOfertas(ctx, opciones, { accion: "mover", turnoAMoverId: turno.id });
      return `¡Claro${nombre ? `, ${nombre}` : ""}! Tu cita actual es la *${describirSlot(cfg, turno)}*. Tengo estos lugares:\n\n${listar(cfg, opciones)}\n\n¿Cuál prefieres? Responde con el número 👆`;
    }
  }

  // 4) Precios.
  if (es(/\b(cuanto|precio|precios|sale|cuesta|valor|tarifa|cobran)\b/, t)) {
    const info = infoNegocio(cfg);
    return `Estos son nuestros valores 👇\n\n${info.servicios.map((s) => `• *${s.nombre}* (${s.duracionMin} min): ${s.precio}`).join("\n")}\n\nPara confirmar la cita pedimos un anticipo del ${cfg.senaPorcentaje}% por Mercado Pago, que se descuenta del total. ¿Te reservo una cita?`;
  }

  // 5) Obra social.
  if (es(/\b(obra social|prepaga|osde|swiss|galeno|medife|cobertura|reintegro)\b/, t)) {
    return `Trabajamos con ${cfg.obrasSociales.join(", ")} por reembolso: te damos la factura y la presentas en tu aseguradora. Si no tienes cobertura, también te atendemos de forma particular. ¿Quieres agendar una cita?`;
  }

  // 6) Ubicación.
  if (es(/\b(donde|direccion|ubicacion|ubicados|llego|queda|como llegar)\b/, t)) {
    return `Estamos en *${cfg.direccion}* 📍 A 2 cuadras de la estación Bulnes de la línea D. ¿Te reservo una cita?`;
  }

  // 7) Pedido de turno nuevo (o menciona día/franja).
  if (quiereTurno || fechas.length || franja || hora || detectarServicio(texto)) {
    const servicioId = detectarServicio(texto) ?? memoria.servicioId ?? "kine";
    const opciones = buscarHorarios(ctx, { fechas: fechas.length ? [fechas[0]] : undefined, franja, hora, limite: 3 });
    if (!opciones.length) {
      return `Para ${fechas.length ? fechaCorta(fechas[0]) : "esos días"} ya no me quedan lugares 😕 ¿Te anoto en la lista de espera? Si se libera algo, te escribo de inmediato.`;
    }
    guardarOfertas(ctx, opciones, { accion: "reservar", servicioId });
    const saludo = turnos.length && !quiereTurno ? "" : nombre ? `¡Hola ${nombre}! ` : "¡Hola! ";
    return `${saludo}Para *${motor.servicio(cfg, servicioId).nombre}* tengo:\n\n${listar(cfg, opciones)}\n\n¿Cuál te reservo? Responde con el número 👆`;
  }

  // 8) Agradecimiento / saludo / ayuda.
  if (es(/\b(gracias|genia|genio|crack|mil gracias)\b/, t)) {
    return `¡De nada${nombre ? `, ${nombre}` : ""}! Cualquier cosa, escríbeme; estoy disponible las 24 h 💚`;
  }
  const proximo = turnos[0];
  return `¡Hola${nombre ? ` ${nombre}` : ""}! 👋 Soy ${cfg.nombreAsistente}, la asistente de *${cfg.nombre}*.${
    proximo ? `\n\nTu próxima cita es la *${describirSlot(cfg, proximo)}*.` : ""
  }\n\nPuedo ayudarte a:\n• Agendar, cambiar o cancelar una cita\n• Consultar precios y obras sociales\n• Decirte cómo llegar\n\n¿Qué necesitas? (también puedes enviarme un audio 🎤)`;
}

function confirmarReserva(ctx: Contexto, slot: Slot, servicioId: string, nombre?: string): string {
  const cfg = ctx.cfg;
  try {
    const { pago } = reservarTurno(ctx, { slot, servicioId, nombre });
    const sena = pago ? formatearMoneda(pago.monto, cfg.locale, cfg.moneda) : "";
    const pila = nombre ? `, ${nombre.split(" ")[0]}` : "";
    return `¡Excelente${pila}! Te reservé *${motor.servicio(cfg, servicioId).nombre}* el *${describirSlot(cfg, slot)}* 🙌\n\nPara confirmarla te pido un anticipo de *${sena}* (${cfg.senaPorcentaje}%) por Mercado Pago. Se descuenta del total el día de la sesión 👇`;
  } catch {
    return "Ese horario se acaba de ocupar 😅 ¿Te busco otro?";
  }
}

/** "Soy Ana Pérez", "me llamo ana", "Ana Pérez" → "Ana Pérez". */
export function extraerNombre(texto: string): string | undefined {
  const limpio = texto
    .trim()
    .replace(/^(hola[,! ]*)?(soy|me llamo|mi nombre es|a nombre de)\s+/i, "")
    .replace(/[.!?,]+$/, "")
    .trim();
  if (!/^[\p{L}' -]{2,40}$/u.test(limpio) || limpio.split(/\s+/).length > 4) return undefined;
  return limpio
    .split(/\s+/)
    .map((p) => p.charAt(0).toLocaleUpperCase("es") + p.slice(1).toLocaleLowerCase("es"))
    .join(" ");
}

function guardarMemoria(ctx: Contexto, memoria: Contexto["estado"]["conversaciones"][string]["memoria"]) {
  const conv = ctx.estado.conversaciones[ctx.telefono];
  if (conv) conv.memoria = memoria;
}

function elegirTurno<T extends Slot>(turnos: T[], fechas: string[]): T | undefined {
  if (!turnos.length) return undefined;
  for (const f of fechas) {
    const t = turnos.find((x) => x.fecha === f);
    if (t) return t;
  }
  return turnos[0];
}

function listar(cfg: Contexto["cfg"], slots: Slot[]): string {
  return slots.map((s, i) => `${NUMEROS[i]} ${describirSlot(cfg, s)}`).join("\n");
}

function guardarOfertas(ctx: Contexto, ofrecidos: Slot[], extra: { accion: "reservar" | "mover"; turnoAMoverId?: string; servicioId?: string }) {
  const conv = ctx.estado.conversaciones[ctx.telefono];
  if (conv) conv.memoria = { ofrecidos, ...extra };
}

function limpiarMemoria(ctx: Contexto) {
  const conv = ctx.estado.conversaciones[ctx.telefono];
  if (conv) conv.memoria = {};
}
