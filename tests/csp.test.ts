import { describe, expect, it } from "vitest";
import { nuevoNonce, politicaCSP } from "@/fabrica/csp";

describe("CSP", () => {
  it("solo permite scripts con nonce, sin unsafe-inline ni unsafe-eval en producción", () => {
    const csp = politicaCSP("abc123");
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-abc123'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    for (const d of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) {
      expect(csp).toContain(d);
    }
  });

  it("en desarrollo añade unsafe-eval (lo necesita React)", () => {
    expect(politicaCSP("x", true)).toContain("'unsafe-eval'");
  });

  it("el nonce cambia en cada petición", () => {
    expect(nuevoNonce()).not.toBe(nuevoNonce());
    expect(nuevoNonce().length).toBeGreaterThanOrEqual(24);
  });
});
