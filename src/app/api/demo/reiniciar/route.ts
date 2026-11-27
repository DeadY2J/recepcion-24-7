import { reiniciarDemo } from "@/fabrica/agenda/almacen";
import { ipDe, limitar, modoDemo } from "@/fabrica/seguridad";

export function POST(req: Request) {
  if (!modoDemo()) return new Response(null, { status: 404 });
  if (!limitar(`reinicio:${ipDe(req)}`, 5, 60_000)) return Response.json({ error: "Demasiadas peticiones" }, { status: 429 });
  reiniciarDemo();
  return Response.json({ ok: true });
}
