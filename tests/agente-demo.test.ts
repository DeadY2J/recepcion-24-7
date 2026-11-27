import { describe, expect, it } from "vitest";
import { detectarFechas, detectarFranja, detectarHora, detectarOpcion, responderDemo } from "@/fabrica/agente/demo";
import type { Contexto } from "@/fabrica/agente/herramientas";
import { crearEstadoDemo, proximoJueves, TELEFONO_DEMO } from "@/fabrica/agenda/semilla";
import { negocio as cfg } from "@/fabrica/negocio/config";

const AHORA = { fecha: "2026-11-24", hora: "23:40" }; // martes, de noche

function conversacion(telefono = TELEFONO_DEMO) {
  const estado = crearEstadoDemo(cfg, AHORA, Date.UTC(2026, 10, 25, 2, 40));
  estado.conversaciones[telefono] = { telefono, mensajes: [], memoria: {} };
  const decir = (texto: string) => {
    const ctx: Contexto = { estado, cfg, ahora: AHORA, telefono, acciones: [] };
    const respuesta = responderDemo(ctx, texto);
    return { respuesta, ctx };
  };
  return { estado, decir };
}

describe("comprensión de modismos regionales", () => {
  it("distingue 'mañana' (día) de 'a la mañana' (franja)", () => {
    expect(detectarFechas("¿tenés algo mañana?", AHORA.fecha)).toEqual(["2026-11-25"]);
    expect(detectarFechas("el jueves a la mañana", AHORA.fecha)).toEqual(["2026-11-26"]);
    expect(detectarFranja("el jueves a la mañana")).toBe("mañana");
    expect(detectarFranja("pasalo a la tarde")).toBe("tarde");
  });

  it("entiende horas coloquiales", () => {
    expect(detectarHora("a las 4 de la tarde")).toBe("16:00");
    expect(detectarHora("tipo 5")).toBe("17:00");
    expect(detectarHora("a las 10")).toBe("10:00");
    expect(detectarHora("18hs")).toBe("18:00");
  });

  it("entiende la elección de opción", () => {
    expect(detectarOpcion("1", 3)).toBe(0);
    expect(detectarOpcion("la segunda", 3)).toBe(1);
    expect(detectarOpcion("opción 3", 3)).toBe(2);
    expect(detectarOpcion("4", 3)).toBeUndefined();
  });
});

describe("guion de la demo: audio de noche para mover la cita", () => {
  it("saluda a Laura por su nombre y recuerda su turno", () => {
    const { decir } = conversacion();
    const { respuesta } = decir("Hola!");
    expect(respuesta).toContain("Laura");
    expect(respuesta).toContain("10:00");
  });

  it("mueve el turno del jueves a la tarde en dos mensajes y libera el hueco", () => {
    const { estado, decir } = conversacion();
    const jueves = proximoJueves(AHORA.fecha);
    const r1 = decir("¿Me puedes pasar la cita del jueves a la tarde?");
    expect(r1.respuesta).toContain("1️⃣");
    const r2 = decir("1");
    expect(r2.respuesta).toContain("Te pasé la cita");
    const turno = estado.turnos.find((t) => t.id === "tur_laura")!;
    expect(turno.fecha).toBe(jueves);
    expect(turno.hora >= "13:00").toBe(true);
    expect(estado.espera.some((e) => e.estado === "ofrecido")).toBe(true);
  });

  it("reserva un turno nuevo y genera el link de seña", () => {
    const { decir } = conversacion("+54 9 11 6000-1234");
    decir("Hola, quería sacar un turno de RPG por la espalda");
    const pregunta = decir("dale, el primero");
    expect(pregunta.respuesta).toContain("A nombre de quién");
    const r = decir("soy ana pérez");
    expect(r.ctx.pagoGenerado?.monto).toBe(10200);
    expect(r.respuesta).toContain("Ana");
    expect(r.respuesta).toContain("Mercado Pago");
  });

  it("solo puede cancelar sus propios turnos", () => {
    const { estado, decir } = conversacion("+54 9 11 6000-9999");
    const r = decir("quiero cancelar mi turno");
    expect(r.respuesta).toContain("No encuentro citas");
    expect(estado.turnos.find((t) => t.id === "tur_laura")!.estado).toBe("confirmado");
  });

  it("entiende modismos de varios países pero responde siempre en neutro (tuteo)", () => {
    const VOSEO = /(vos|tenés|querés|podés|necesitás|decime|escribime|mandame|respondé|pagá|elegí|mirá|acá|turno|seña)/i;
    const frases = [
      "¿me podés pasar la cita del jueves a la tarde?", // Río de la Plata
      "oye pana, quiero una cita para mañana", // Venezuela
      "güey, ¿cuánto cuesta la sesión?", // México
      "parce, necesito cancelar mi cita", // Colombia
      "hola",
    ];
    for (const f of frases) {
      const { decir } = conversacion();
      expect(decir(f).respuesta).not.toMatch(VOSEO);
    }
    const { decir } = conversacion();
    expect(decir("¿cuánto sale?").respuesta).toContain("anticipo");
  });

  it("responde precios y obras sociales", () => {
    const { decir } = conversacion();
    expect(decir("¿cuánto sale la sesión?").respuesta).toMatch(/28\.000/);
    expect(decir("¿atienden por OSDE?").respuesta).toContain("OSDE");
  });
});
