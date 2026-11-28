import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { aprobarPagoConfirmado, crearPago } from "@/fabrica/agenda/motor";
import { crearEstadoDemo } from "@/fabrica/agenda/semilla";
import { negocio as cfg } from "@/fabrica/negocio/config";
import { verificarFirmaWebhook } from "@/fabrica/pagos/mercadopago";

const AHORA = { fecha: "2026-11-24", hora: "10:00" };
const SECRETO = "secreto-de-prueba";

function firmar(id: string, req: string, ts: number, secreto = SECRETO) {
  const v1 = createHmac("sha256", secreto).update(`id:${id};request-id:${req};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

afterEach(() => {
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
});

describe("webhook de Mercado Pago", () => {
  it("sin secreto configurado rechaza cualquier notificación", () => {
    const ahora = Date.now();
    expect(verificarFirmaWebhook(firmar("123", "r1", ahora), "r1", "123", ahora)).toBe(false);
  });

  it("acepta solo firmas válidas, del mismo request-id y recientes", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRETO;
    const ahora = 1_780_000_000_000;
    const seg = Math.floor(ahora / 1000);
    expect(verificarFirmaWebhook(firmar("123", "r1", seg), "r1", "123", ahora)).toBe(true);
    expect(verificarFirmaWebhook(firmar("123", "r1", seg, "otro"), "r1", "123", ahora)).toBe(false);
    expect(verificarFirmaWebhook(firmar("123", "r1", seg), "r2", "123", ahora)).toBe(false);
    expect(verificarFirmaWebhook(firmar("123", "r1", seg), "r1", "124", ahora)).toBe(false);
    expect(verificarFirmaWebhook(firmar("123", "r1", seg - 3600), "r1", "123", ahora)).toBe(false);
    expect(verificarFirmaWebhook("basura", "r1", "123", ahora)).toBe(false);
    expect(verificarFirmaWebhook(null, "r1", "123", ahora)).toBe(false);
  });

  it("solo aprueba el anticipo si el importe pagado lo cubre", () => {
    const estado = crearEstadoDemo(cfg, AHORA);
    const turno = estado.turnos.find((t) => t.estado !== "cancelado")!;
    const pago = crearPago(estado, cfg, turno);
    expect(aprobarPagoConfirmado(estado, cfg, pago.id, pago.monto - 1)).toBeNull();
    expect(pago.estado).toBe("pendiente");
    expect(aprobarPagoConfirmado(estado, cfg, "pago_inexistente", 1e9)).toBeNull();
    expect(aprobarPagoConfirmado(estado, cfg, pago.id, pago.monto)?.estado).toBe("aprobado");
  });
});
