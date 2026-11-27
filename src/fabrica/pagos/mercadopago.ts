/**
 * Módulo de cobros. En modo demo el link lleva a un checkout simulado
 * (/pago/[id]). Con MERCADOPAGO_ACCESS_TOKEN crea una preferencia real de
 * Checkout Pro y devuelve su init_point.
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post
 */
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

/** Consulta un pago notificado por webhook y devuelve el id interno si está aprobado. */
export async function verificarPagoMercadoPago(paymentId: string): Promise<string | null> {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { status: string; external_reference?: string };
  return data.status === "approved" ? data.external_reference ?? null : null;
}
