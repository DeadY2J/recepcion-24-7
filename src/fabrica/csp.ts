/**
 * Política de seguridad de contenido (CSP) completa, con nonce por petición.
 * La aplica `src/proxy.ts` a todas las páginas; Next.js añade el nonce a sus propios scripts.
 *  - script-src: solo scripts con el nonce de esta petición ('strict-dynamic' para los que carguen ellos).
 *    Nada de 'unsafe-inline'. 'unsafe-eval' solo en desarrollo (lo pide React para depurar).
 *  - style-src: 'unsafe-inline' sin nonce, porque React usa atributos style="" (un nonce no los cubre).
 *    El riesgo de estilos en línea es bajo frente al de scripts.
 *  - Todo lo demás, solo el propio origen (más data:/blob: para imágenes y audio generados en el navegador).
 */
export function politicaCSP(nonce: string, desarrollo = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(desarrollo ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Nonce impredecible y distinto en cada petición (128 bits). */
export function nuevoNonce(): string {
  return btoa(crypto.randomUUID());
}
