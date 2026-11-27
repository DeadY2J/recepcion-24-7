import { z } from "zod";
import { procesarMensaje } from "@/fabrica/agente";
import { ipDe, limitar, modoDemo } from "@/fabrica/seguridad";

const Entrada = z.object({
  telefono: z.string().min(6).max(25),
  texto: z.string().trim().min(1).max(1000),
  audioSegundos: z.number().int().min(1).max(300).optional(),
});

export async function POST(req: Request) {
  if (!modoDemo()) return new Response(null, { status: 404 });
  if (!limitar(`chat:${ipDe(req)}`, 20, 60_000)) return Response.json({ error: "Demasiadas peticiones, espera un momento." }, { status: 429 });
  const datos = Entrada.safeParse(await req.json().catch(() => null));
  if (!datos.success) return Response.json({ error: "Mensaje inválido" }, { status: 400 });
  const r = await procesarMensaje(datos.data.telefono, datos.data.texto, { audioSegundos: datos.data.audioSegundos });
  return Response.json(r);
}
