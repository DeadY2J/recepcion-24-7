import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Palabras y formas que no deben aparecer en textos visibles (voseo y regionalismos). */
const PROHIBIDAS = [
  /\bvos\b/i, /\bche\b/i, /\bacá\b/i, /\bturnos?\b/i, /\bseñas?\b/i, /\bpibes?\b/i, /\bgüey\b/i, /\bpana\b/i,
  /\bchévere\b/i, /\bplata\b/i, /\bdale\b/i, /\bjoya\b/i,
  // Voseo: tenés, querés, podés, reservá, llamá, elegí…
  /\b(tenés|querés|podés|sabés|reservá|llamá|elegí|probá|escribí|avisá|venís|mirá|revisá|decime|contame|escribile|pedile)(?![\p{L}])/iu,
];

/**
 * Archivos que deben ENTENDER modismos y por eso los contienen a propósito:
 * el agente por reglas (patrones de entrada del paciente) y el prompt del modelo (que los nombra para prohibirlos).
 * Sus RESPUESTAS se comprueban en tests/agente-demo.test.ts.
 */
const EXCEPCIONES = new Set(["fabrica/agente/demo.ts", "fabrica/agente/llm.ts"]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

/** Solo los literales de texto (entre comillas o en JSX), no los identificadores del código. */
function textos(codigo: string): string[] {
  const literales = codigo.match(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g) ?? [];
  const jsx = codigo.match(/>[^<>{}]+</g) ?? [];
  // Quita las interpolaciones ${…}: son código (p. ej. turno.hora), no texto visible.
  return [...literales, ...jsx].map((t) => t.replace(/\$\{[^}]*\}/g, ""));
}

describe("español neutro en los textos visibles", () => {
  const raiz = path.resolve(import.meta.dirname, "../src");
  for (const archivo of archivos(raiz)) {
    const rel = path.relative(raiz, archivo).split(path.sep).join("/");
    if (EXCEPCIONES.has(rel)) continue;
    it(`sin voseo ni regionalismos: ${rel}`, () => {
      const encontrados = textos(readFileSync(archivo, "utf8")).filter((t) => PROHIBIDAS.some((re) => re.test(t)));
      expect(encontrados).toEqual([]);
    });
  }

  it("el detector sí detecta voseo", () => {
    expect(textos('const a = "Che, ¿querés reservar un turno?";').some((t) => PROHIBIDAS.some((re) => re.test(t)))).toBe(true);
    expect(textos('const b = "Escribí un mensaje";').some((t) => PROHIBIDAS.some((re) => re.test(t)))).toBe(true);
  });
});
