/**
 * Datos de demo creíbles: una clínica con agenda bastante llena, lista de
 * espera e historial del mes. Determinista (misma semilla = misma agenda)
 * para que los tests y los vídeos de demo sean reproducibles.
 */
import type { ConfigNegocio } from "../negocio/config";
import { horasDelDia, montoSena, nuevoId, registrarEvento, servicio } from "./motor";
import type { Ahora } from "./tiempo";
import { aMinutos, ahoraEn, diaSemana, sumarDias } from "./tiempo";
import type { Estado, Turno } from "./tipos";

export const TELEFONO_DEMO = "+54 9 11 5555-0101";

const NOMBRES = [
  "Laura Gómez", "Martín Fernández", "Lucía Pereyra", "Diego Sosa", "Valentina Ruiz", "Facundo Díaz",
  "Camila Herrera", "Nicolás Álvarez", "Julieta Benítez", "Matías Romero", "Florencia Castro", "Santiago Molina",
  "Agustina Ortiz", "Joaquín Silva", "Rocío Medina", "Federico Rojas", "Micaela Acosta", "Gonzalo Vega",
  "Sol Navarro", "Ignacio Torres", "Marta Quiroga", "Pablo Giménez", "Antonella Ríos", "Bruno Cabrera",
];

function prng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Próximo jueves estrictamente posterior a hoy (para el guion de la demo). */
export function proximoJueves(hoy: string): string {
  for (let i = 1; i <= 7; i++) {
    const f = sumarDias(hoy, i);
    if (diaSemana(f) === 4) return f;
  }
  return sumarDias(hoy, 7);
}

/** El mismo día local que `baseMs`, pero a los `minutos` indicados (hora del negocio). */
function tsALaHora(baseMs: number, zonaHoraria: string, minutos: number): number {
  const local = aMinutos(ahoraEn(zonaHoraria, new Date(baseMs)).hora);
  return baseMs + (minutos - local) * 60_000;
}

export function crearEstadoDemo(cfg: ConfigNegocio, ahora: Ahora, ahoraMs: number = Date.now()): Estado {
  const azar = prng(42);
  const estado: Estado = { pacientes: [], turnos: [], espera: [], pagos: [], eventos: [], conversaciones: {}, secuencia: 0 };

  NOMBRES.forEach((nombre, i) => {
    estado.pacientes.push({
      id: `pac_${i}`,
      nombre,
      telefono: i === 0 ? TELEFONO_DEMO : `+54 9 11 5555-${String(200 + i).padStart(4, "0")}`,
      obraSocial: cfg.obrasSociales[i % (cfg.obrasSociales.length + 1)],
    });
  });
  const laura = estado.pacientes[0];
  const jueves = proximoJueves(ahora.fecha);

  // Turno de Laura: el jueves por la mañana (el guion de la demo lo pasa a la tarde).
  const turnoLaura: Turno = {
    id: "tur_laura",
    pacienteId: laura.id,
    servicioId: "kine",
    fecha: jueves,
    hora: "10:00",
    profesionalId: "lic-paz",
    estado: "confirmado",
    senaPagada: true,
    origen: "ia",
    creadoEn: ahoraMs - 5 * 86400000,
  };
  estado.turnos.push(turnoLaura);

  // Huecos que la demo necesita libres (jueves a la tarde).
  const reservadosLibres = new Set([`${jueves}|16:00|lic-paz`, `${jueves}|17:00|lic-romero`, `${jueves}|18:00|lic-paz`]);

  for (let d = 0; d < 14; d++) {
    const fecha = sumarDias(ahora.fecha, d);
    const ocupacion = d < 3 ? 0.78 : d < 7 ? 0.62 : 0.4;
    for (const hora of horasDelDia(cfg, fecha)) {
      for (const prof of cfg.profesionales) {
        const clave = `${fecha}|${hora}|${prof.id}`;
        if (reservadosLibres.has(clave)) continue;
        if (fecha === jueves && hora === "10:00" && prof.id === "lic-paz") continue;
        if (azar() > ocupacion) continue;
        const pac = estado.pacientes[1 + Math.floor(azar() * (NOMBRES.length - 1))];
        const servicioId = prof.id === "lic-iglesias" ? "rpg" : azar() > 0.85 ? "deportiva" : "kine";
        const pasado = d === 0 && aMinutos(hora) <= aMinutos(ahora.hora);
        const r = azar();
        estado.turnos.push({
          id: `tur_s${estado.turnos.length}`,
          pacienteId: pac.id,
          servicioId,
          fecha,
          hora,
          profesionalId: prof.id,
          estado: !pasado && r > 0.9 ? "pendiente_sena" : "confirmado",
          senaPagada: pasado || r <= 0.9,
          origen: r < 0.55 ? "ia" : r < 0.95 ? "recepcion" : "lista_espera",
          creadoEn: ahoraMs - Math.floor(azar() * 10) * 86400000,
        });
      }
    }
  }

  // Lista de espera.
  const espera: Array<[number, string, "mañana" | "tarde" | "cualquiera"]> = [
    [20, "kine", "tarde"],
    [9, "rpg", "cualquiera"],
    [14, "kine", "mañana"],
    [5, "deportiva", "tarde"],
  ];
  for (const [i, servicioId, preferencia] of espera) {
    estado.espera.push({ id: `esp_${i}`, pacienteId: estado.pacientes[i].id, servicioId, preferencia, estado: "esperando" });
  }

  // Historial del mes para que el panel cuente una historia.
  estado.secuencia = 1000;
  // Las consultas nocturnas llegan a horas creíbles para que el dial de 24 h cuente la historia.
  const NOCHE = ["23:14", "21:40", "00:35", "22:20", "07:10", "23:50", "20:45", "06:30", "01:15"];
  const historial: Array<[number, Parameters<typeof registrarEvento>[1], string, number | undefined, string | null]> = [];
  for (let i = 0; i < 18; i++) {
    const pac = estado.pacientes[1 + Math.floor(azar() * 20)];
    const precio = servicio(cfg, "kine").precio;
    const diasAtras = 1 + Math.floor(azar() * 20);
    const nocturno = azar() > 0.5;
    const hora = nocturno ? NOCHE[i % NOCHE.length] : null;
    historial.push([diasAtras, "turno_reservado", `${pac.nombre} reservó por WhatsApp${hora ? ` (${hora} h, fuera de horario)` : ""}`, undefined, hora]);
    if (hora) historial.push([diasAtras, "mensaje_fuera_de_horario", `Consulta de ${pac.nombre} respondida fuera de horario`, undefined, hora]);
    if (azar() > 0.25) historial.push([diasAtras, "sena_cobrada", `Anticipo de ${pac.nombre} cobrado por Mercado Pago`, montoSena(cfg, "kine"), hora]);
    if (i % 3 === 0) historial.push([diasAtras, "hueco_recuperado", `Hueco recuperado desde la lista de espera para ${pac.nombre}`, precio, null]);
  }
  historial
    .sort((a, b) => b[0] - a[0])
    .forEach(([diasAtras, tipo, texto, monto, hora]) => {
      const minutos = hora ? aMinutos(hora) : 9 * 60 + Math.floor(azar() * 600);
      registrarEvento(estado, tipo, texto, { monto, porIA: true, ts: tsALaHora(ahoraMs - diasAtras * 86400000, cfg.zonaHoraria, minutos) });
    });
  nuevoId(estado, "seed");
  return estado;
}
