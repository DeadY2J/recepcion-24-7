import { conEstado } from "@/fabrica/agenda/almacen";
import { aprobarPago } from "@/fabrica/agenda/motor";
import { negocio } from "@/fabrica/negocio/config";
import { verificarPagoMercadoPago } from "@/fabrica/pagos/mercadopago";

/** Notificaciones de Mercado Pago: nunca confiamos en el cuerpo, consultamos el pago a la API. */
export async function POST(req: Request) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return new Response(null, { status: 404 });
  const cuerpo = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string } };
  if (cuerpo.type === "payment" && cuerpo.data?.id) {
    const pagoId = await verificarPagoMercadoPago(String(cuerpo.data.id));
    if (pagoId) conEstado((estado) => aprobarPago(estado, negocio, pagoId));
  }
  return new Response(null, { status: 200 });
}
