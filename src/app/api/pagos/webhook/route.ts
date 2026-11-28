import { conEstado } from "@/fabrica/agenda/almacen";
import { aprobarPagoConfirmado } from "@/fabrica/agenda/motor";
import { negocio } from "@/fabrica/negocio/config";
import { verificarFirmaWebhook, verificarPagoMercadoPago } from "@/fabrica/pagos/mercadopago";
import { ipDe, limitar } from "@/fabrica/seguridad";

/**
 * Notificaciones de Mercado Pago. Exige la firma x-signature (MERCADOPAGO_WEBHOOK_SECRET),
 * consulta el pago a la API (nunca se fía del cuerpo) y comprueba que el importe cubre el anticipo.
 * Aprobar dos veces el mismo pago no tiene efecto (aprobarPago es idempotente).
 */
export async function POST(req: Request) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return new Response(null, { status: 404 });
  if (!limitar(`mp:${ipDe(req)}`, 120, 60_000)) return new Response(null, { status: 429 });
  const url = new URL(req.url);
  const cuerpo = (await req.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null;
  const idDato = String(url.searchParams.get("data.id") ?? cuerpo?.data?.id ?? "");
  if (!verificarFirmaWebhook(req.headers.get("x-signature"), req.headers.get("x-request-id"), idDato)) {
    return new Response("Firma no válida", { status: 401 });
  }
  if ((url.searchParams.get("type") ?? cuerpo?.type) !== "payment") return new Response(null, { status: 200 });
  try {
    const confirmado = await verificarPagoMercadoPago(idDato);
    if (confirmado) conEstado((estado) => aprobarPagoConfirmado(estado, negocio, confirmado.pagoId, confirmado.importe));
  } catch {
    // 500 para que Mercado Pago reintente más tarde.
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
}
