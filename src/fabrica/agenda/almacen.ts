/**
 * Almacén en memoria para la demo (cero configuración: npm run dev y listo).
 * En producción se sustituye por Supabase/Postgres implementando las mismas
 * funciones `leerEstado` / `conEstado`; el motor no cambia.
 */
import { negocio } from "../negocio/config";
import { resolverOfertasPendientes } from "./motor";
import { crearEstadoDemo } from "./semilla";
import { ahoraEn } from "./tiempo";
import type { Estado } from "./tipos";

const g = globalThis as unknown as { __fabricaEstado?: Estado };

export function ahoraNegocio() {
  return ahoraEn(negocio.zonaHoraria);
}

export function leerEstado(): Estado {
  if (!g.__fabricaEstado) g.__fabricaEstado = crearEstadoDemo(negocio, ahoraNegocio());
  resolverOfertasPendientes(g.__fabricaEstado, negocio);
  return g.__fabricaEstado;
}

/** Ejecuta una mutación sobre el estado (punto único para cambiar a una BD transaccional). */
export function conEstado<T>(fn: (estado: Estado) => T): T {
  return fn(leerEstado());
}

export function reiniciarDemo(): Estado {
  g.__fabricaEstado = crearEstadoDemo(negocio, ahoraNegocio());
  return g.__fabricaEstado;
}
