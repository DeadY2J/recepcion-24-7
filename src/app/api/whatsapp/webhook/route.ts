import { createHash, timingSafeEqual } from "node:crypto";
import { procesarMensaje } from "@/fabrica/agente";
import { enviarTexto, extraerMensajes, verificarFirma, whatsappActivo } from "@/fabrica/whatsapp/cloud-api";

/** Verificación del webhook desde el panel de Meta. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  const recibido = url.searchParams.get("hub.verify_token") ?? "";
  // Comparación en tiempo constante (sobre hashes para igualar longitudes).
  const h = (t: string) => createHash("sha256").update(t).digest();
  const ok = url.searchParams.get("hub.mode") === "subscribe" && Boolean(esperado) && timingSafeEqual(h(recibido), h(esperado!));
  return ok ? new Response(url.searchParams.get("hub.challenge")) : new Response("Forbidden", { status: 403 });
}

/** Meta reintenta las entregas: recordamos los ids ya procesados para no responder dos veces. */
const procesados = new Set<string>();

export async function POST(req: Request) {
  if (!whatsappActivo()) return new Response(null, { status: 404 });
  const crudo = await req.text();
  if (!verificarFirma(crudo, req.headers.get("x-hub-signature-256"))) return new Response("Firma inválida", { status: 401 });
  let payload: Parameters<typeof extraerMensajes>[0];
  try {
    payload = JSON.parse(crudo);
  } catch {
    return new Response("Cuerpo inválido", { status: 400 });
  }
  for (const m of extraerMensajes(payload)) {
    if (procesados.has(m.id)) continue;
    procesados.add(m.id);
    if (procesados.size > 2000) procesados.delete(procesados.values().next().value!);
    const r = await procesarMensaje(m.de, m.texto);
    let texto = r.mensaje.texto;
    if (r.mensaje.pagoId) texto += `\n\n💳 Paga el anticipo aquí: ${new URL(req.url).origin}/pago/${r.mensaje.pagoId}`;
    try {
      await enviarTexto(m.de, texto);
    } catch (e) {
      console.error("[whatsapp] No se pudo enviar la respuesta:", e);
    }
  }
  return new Response(null, { status: 200 });
}
