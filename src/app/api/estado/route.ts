import { modoDemo } from "@/fabrica/seguridad";
import { vistaPanel } from "@/fabrica/vista";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  if (!modoDemo()) return new Response(null, { status: 404 });
  const url = new URL(req.url);
  return Response.json(vistaPanel(url.searchParams.get("fecha") ?? undefined, url.searchParams.get("telefono") ?? undefined));
}
