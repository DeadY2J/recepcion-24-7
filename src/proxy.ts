import { NextResponse, type NextRequest } from "next/server";
import { nuevoNonce, politicaCSP } from "@/fabrica/csp";

/** Pone la CSP con nonce en cada página. Las rutas API y los estáticos no la necesitan. */
export function proxy(request: NextRequest) {
  const nonce = nuevoNonce();
  const csp = politicaCSP(nonce, process.env.NODE_ENV === "development");
  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("Content-Security-Policy", csp);
  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|mp3|ogg|wav|webm)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
