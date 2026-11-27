import { describe, expect, it } from "vitest";
import * as motor from "@/fabrica/agenda/motor";
import { crearEstadoDemo, proximoJueves } from "@/fabrica/agenda/semilla";
import { sumarDias } from "@/fabrica/agenda/tiempo";
import { negocio as cfg } from "@/fabrica/negocio/config";

const AHORA = { fecha: "2026-11-24", hora: "11:30" }; // martes
const T0 = Date.UTC(2026, 10, 24, 14, 30);
const nuevoEstado = () => crearEstadoDemo(cfg, AHORA, T0);

describe("agenda", () => {
  it("no ofrece horarios pasados ni ocupados", () => {
    const e = nuevoEstado();
    const libres = motor.slotsLibres(e, cfg, AHORA, { dias: 3, limite: 500 });
    expect(libres.length).toBeGreaterThan(0);
    for (const s of libres) {
      expect(motor.esFuturo(s, AHORA)).toBe(true);
      expect(motor.slotOcupado(e, s)).toBe(false);
    }
  });

  it("respeta el horario de atención (domingo cerrado, sábado hasta las 13)", () => {
    const e = nuevoEstado();
    const domingo = sumarDias(AHORA.fecha, 5); // 29/11 es domingo
    const sabado = sumarDias(AHORA.fecha, 4);
    expect(motor.slotsLibres(e, cfg, AHORA, { fechas: [domingo] })).toHaveLength(0);
    expect(motor.horasDelDia(cfg, sabado)).toEqual(["09:00", "10:00", "11:00", "12:00"]);
  });

  it("reservar genera una seña del 30% y no permite doble reserva", () => {
    const e = nuevoEstado();
    const [slot] = motor.slotsLibres(e, cfg, AHORA, { limite: 1 });
    const { turno, pago } = motor.reservar(e, cfg, AHORA, { pacienteId: "pac_3", slot, servicioId: "kine" });
    expect(turno.estado).toBe("pendiente_sena");
    expect(pago?.monto).toBe(8400);
    expect(() => motor.reservar(e, cfg, AHORA, { pacienteId: "pac_4", slot, servicioId: "kine" })).toThrow(/ocupado/);
    motor.aprobarPago(e, cfg, pago!.id);
    expect(turno.estado).toBe("confirmado");
    expect(turno.senaPagada).toBe(true);
  });

  it("al cancelar ofrece el hueco a la lista de espera y lo recupera", () => {
    const e = nuevoEstado();
    const turno = e.turnos.find((t) => t.id === "tur_laura")!;
    const antes = motor.metricas(e, cfg, AHORA);
    motor.cancelar(e, cfg, AHORA, turno.id);
    const ofrecido = e.espera.find((x) => x.estado === "ofrecido");
    expect(ofrecido?.oferta).toMatchObject({ fecha: turno.fecha, hora: "10:00" });
    // Mientras está ofrecido, nadie más puede reservarlo.
    expect(motor.slotOcupado(e, turno)).toBe(true);
    const nuevos = motor.resolverOfertasPendientes(e, cfg, T0 + 60_000 + Date.now());
    expect(nuevos).toHaveLength(1);
    expect(nuevos[0].origen).toBe("lista_espera");
    const despues = motor.metricas(e, cfg, AHORA);
    expect(despues.huecosRecuperados).toBe(antes.huecosRecuperados + 1);
    expect(despues.dineroRecuperado).toBeGreaterThan(antes.dineroRecuperado);
  });

  it("la semilla deja libre el jueves a la tarde para el guion", () => {
    const e = nuevoEstado();
    const jueves = proximoJueves(AHORA.fecha);
    const tarde = motor.slotsLibres(e, cfg, AHORA, { fechas: [jueves], franja: "tarde" });
    expect(tarde.map((s) => s.hora)).toContain("16:00");
  });
});
