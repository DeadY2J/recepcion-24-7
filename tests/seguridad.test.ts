import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { crearPago } from "@/fabrica/agenda/motor";
import { crearEstadoDemo } from "@/fabrica/agenda/semilla";
import { negocio as cfg } from "@/fabrica/negocio/config";
import { limitar, modoDemo, reiniciarLimites } from "@/fabrica/seguridad";
import { verificarFirma } from "@/fabrica/whatsapp/cloud-api";

const AHORA = { fecha: "2026-11-24", hora: "10:00" };

afterEach(() => {
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.DEMO_PUBLICA;
  reiniciarLimites();
});

describe("seguridad", () => {
  it("los ids de pago no se pueden adivinar", () => {
    const estado = crearEstadoDemo(cfg, AHORA);
    const a = crearPago(estado, cfg, estado.turnos[0]);
    const b = crearPago(estado, cfg, estado.turnos[0]);
    expect(a.id).toMatch(/^pago_[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
  });

  it("los endpoints del simulador se apagan cuando hay WhatsApp real", () => {
    expect(modoDemo()).toBe(true);
    process.env.WHATSAPP_TOKEN = "x";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1";
    expect(modoDemo()).toBe(false);
    process.env.DEMO_PUBLICA = "1";
    expect(modoDemo()).toBe(true);
  });

  it("el límite de peticiones bloquea el exceso y se libera con el tiempo", () => {
    for (let i = 0; i < 3; i++) expect(limitar("ip", 3, 1000, 1000 + i)).toBe(true);
    expect(limitar("ip", 3, 1000, 1500)).toBe(false);
    expect(limitar("otra", 3, 1000, 1500)).toBe(true);
    expect(limitar("ip", 3, 1000, 2500)).toBe(true);
  });

  it("la firma del webhook de WhatsApp se valida y rechaza cuerpos alterados", () => {
    process.env.WHATSAPP_APP_SECRET = "secreto";
    const cuerpo = '{"a":1}';
    const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
    expect(verificarFirma(cuerpo, firma)).toBe(true);
    expect(verificarFirma('{"a":2}', firma)).toBe(false);
    expect(verificarFirma(cuerpo, null)).toBe(false);
    delete process.env.WHATSAPP_APP_SECRET;
    expect(verificarFirma(cuerpo, firma)).toBe(false);
  });
});
