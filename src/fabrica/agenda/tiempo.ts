/**
 * Utilidades de fecha. Todas las fechas de la agenda son strings en la zona
 * horaria del negocio: fecha "YYYY-MM-DD" y hora "HH:mm". Así evitamos los
 * líos de husos horarios entre el servidor (UTC), el negocio (Buenos Aires)
 * y quien prueba la demo (España).
 */

export type Ahora = { fecha: string; hora: string };

export function ahoraEn(zonaHoraria: string, d: Date = new Date()): Ahora {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  return { fecha: `${p("year")}-${p("month")}-${p("day")}`, hora: `${p("hour")}:${p("minute")}` };
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diaSemana(fecha: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function nombreDia(fecha: string): string {
  return DIAS[diaSemana(fecha)];
}

/** "jueves 27 de noviembre" */
export function fechaLarga(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${nombreDia(fecha)} ${d} de ${MESES[m - 1]}`;
}

/** "jueves 27/11" */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${nombreDia(fecha)} ${d}/${m}`;
}

export function franjaDe(hora: string): "mañana" | "tarde" | "noche" {
  const min = aMinutos(hora);
  if (min < 13 * 60) return "mañana";
  if (min < 19 * 60) return "tarde";
  return "noche";
}

export function formatearMoneda(valor: number, locale: string, moneda: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(valor);
}
