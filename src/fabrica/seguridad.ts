/**
 * Utilidades de seguridad compartidas por las rutas API.
 *  - modoDemo(): los endpoints del simulador (chat web, panel, reinicio) solo
 *    existen mientras no haya integraciones reales (WhatsApp o Mercado Pago).
 *    Con cuentas reales cualquiera podría escribir como otro paciente.
 *  - limitar(): límite de peticiones por clave (IP) en ventana deslizante, en memoria.
 */
import { mercadoPagoActivo } from "./pagos/mercadopago";
import { whatsappActivo } from "./whatsapp/cloud-api";

export function modoDemo(): boolean {
  if (process.env.DEMO_PUBLICA === "1") return true;
  return !whatsappActivo() && !mercadoPagoActivo();
}

const ventanas = new Map<string, number[]>();

/** Devuelve true si la petición cabe en el límite; false si hay que rechazarla (429). */
export function limitar(clave: string, max: number, ventanaMs: number, ahora: number = Date.now()): boolean {
  const recientes = (ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= max) {
    ventanas.set(clave, recientes);
    return false;
  }
  recientes.push(ahora);
  ventanas.set(clave, recientes);
  if (ventanas.size > 5000) for (const [k, v] of ventanas) if (!v.some((t) => ahora - t < ventanaMs)) ventanas.delete(k);
  return true;
}

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function reiniciarLimites() {
  ventanas.clear();
}
