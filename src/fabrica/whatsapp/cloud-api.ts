/**
 * WhatsApp Cloud API (Meta). Lo mínimo para un asistente real:
 *  - verificar el webhook (GET con hub.challenge)
 *  - validar la firma X-Hub-Signature-256 de cada POST
 *  - extraer mensajes de texto entrantes
 *  - enviar respuestas
 *
 * Variables: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappActivo(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function verificarFirma(cuerpoCrudo: string, firma: string | null): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) return false;
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex");
  const a = Buffer.from(firma.slice(7), "hex");
  const b = Buffer.from(esperada, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type MensajeEntrante = { de: string; texto: string; id: string };

type PayloadWebhook = {
  entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from: string; id: string; type: string; text?: { body: string } }> } }> }>;
};

export function extraerMensajes(payload: PayloadWebhook): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (m.type === "text" && m.text?.body) salida.push({ de: m.from, texto: m.text.body, id: m.id });
        // Audios: descargar el media id y transcribir (pendiente: módulo de transcripción).
      }
    }
  }
  return salida;
}

export async function enviarTexto(para: string, texto: string): Promise<void> {
  const r = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto, preview_url: true } }),
  });
  if (!r.ok) throw new Error(`WhatsApp respondió ${r.status}: ${await r.text()}`);
}
