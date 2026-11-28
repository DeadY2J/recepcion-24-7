/**
 * Módulo de cobros. En modo demo el link lleva a un checkout simulado
 * (/pago/[id]). Con MERCADOPAGO_ACCESS_TOKEN crea una preferencia real de
 * Checkout Pro y devuelve su init_point.
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Pago } from "../agenda/tipos";
import type { ConfigNegocio } from "../negocio/config";

export function mercadoPagoActivo(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

export async function crearLinkDePago(
  pago: Pago,
  cfg: ConfigNegocio,
  descripcion: string,
  urlBase: string,
): Promise<string> {
  if (!mercadoPagoActivo()) return pago.url;
  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": pago.id,
    },
    body: JSON.stringify({
      items: [{ title: `Anticipo · ${descripcion}`, quantity: 1, unit_price: pago.monto, currency_id: cfg.moneda }],
      external_reference: pago.id,
      notification_url: `${urlBase}/api/pagos/webhook`,
      back_urls: { success: `${urlBase}/pago/${pago.id}?estado=ok` },
      auto_return: "approved",
    }),
  });
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}`);
  const data = (await r.json()) as { init_point: string };
  return data.init_point;
}

/**
 * Firma del webhook (MERCADOPAGO_WEBHOOK_SECRET): x-signature = "ts=...,v1=..." y el manifiesto
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" firmado con HMAC-SHA256.
 * Docs: https://www.mercadopago.com/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verificarFirmaWebhook(
  firma: string | null,
  idPeticion: string | null,
  idDato: string,
  ahoraMs: number = Date.now(),
): boolean {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secreto || !firma || !idPeticion || !idDato) return false;
  const partes = Object.fromEntries(firma.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const { ts, v1 } = partes;
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/.test(v1)) return false;
  // Rechaza notificaciones viejas (repetición). La documentación usa segundos; se aceptan también milisegundos.
  const tsMs = ts.length <= 11 ? Number(ts) * 1000 : Number(ts);
  if (Math.abs(ahoraMs - tsMs) > 10 * 60_000) return false;
  const manifiesto = `id:${idDato.toLowerCase()};request-id:${idPeticion};ts:${ts};`;
  const esperada = createHmac("sha256", secreto).update(manifiesto).digest();
  return timingSafeEqual(Buffer.from(v1, "hex"), esperada);
}

export type PagoConfirmado = { pagoId: string; importe: number };

/** Consulta un pago notificado por webhook a la API oficial (nunca se confía en el cuerpo). */
export async function verificarPagoMercadoPago(paymentId: string): Promise<PagoConfirmado | null> {
  if (!/^\d{1,20}$/.test(paymentId)) return null;
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}`);
  const data = (await r.json()) as { status?: string; external_reference?: string; transaction_amount?: number };
  if (data.status !== "approved" || !data.external_reference || typeof data.transaction_amount !== "number") return null;
  return { pagoId: data.external_reference, importe: data.transaction_amount };
}
