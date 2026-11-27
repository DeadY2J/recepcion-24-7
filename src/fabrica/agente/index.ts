/**
 * Punto de entrada de la conversación: recibe un mensaje (del simulador web o
 * del webhook real de WhatsApp), lo pasa al agente y guarda la respuesta.
 */
import type { ModelMessage } from "ai";
import { conEstado, ahoraNegocio } from "../agenda/almacen";
import { nuevoId, normalizarTelefono, registrarEvento, pacientePorTelefono } from "../agenda/motor";
import { aMinutos } from "../agenda/tiempo";
import type { Mensaje } from "../agenda/tipos";
import { negocio } from "../negocio/config";
import { responderDemo } from "./demo";
import type { Contexto } from "./herramientas";
import { modeloConfigurado, responderConLLM } from "./llm";

export type Respuesta = { mensaje: Mensaje; motor: string; acciones: string[] };

export async function procesarMensaje(
  telefonoCrudo: string,
  texto: string,
  opciones: { audioSegundos?: number } = {},
): Promise<Respuesta> {
  const telefono = `+${normalizarTelefono(telefonoCrudo)}`;
  const ahora = ahoraNegocio();

  const { ctx, historial } = conEstado((estado) => {
    // Unificamos la clave de conversación con el teléfono guardado del paciente.
    const clave = pacientePorTelefono(estado, telefono)?.telefono ?? telefono;
    const conv = (estado.conversaciones[clave] ??= { telefono: clave, mensajes: [], memoria: {} });
    conv.mensajes.push({
      id: nuevoId(estado, "msg"),
      rol: "cliente",
      texto,
      ts: Date.now(),
      audio: opciones.audioSegundos ? { segundos: opciones.audioSegundos } : undefined,
    });
    const minutos = aMinutos(ahora.hora);
    if (minutos < 8 * 60 || minutos >= 20 * 60) {
      const nombre = pacientePorTelefono(estado, clave)?.nombre ?? clave;
      const texto = `${nombre} escribió a las ${ahora.hora} h, con la clínica cerrada, y recibió respuesta al instante`;
      // Una sola vez por conversación cada media hora, para no inflar la métrica.
      const reciente = estado.eventos.some(
        (e) => e.tipo === "mensaje_fuera_de_horario" && e.texto.startsWith(`${nombre} escribió`) && Date.now() - e.ts < 30 * 60_000,
      );
      if (!reciente) registrarEvento(estado, "mensaje_fuera_de_horario", texto);
    }
    const ctx: Contexto = { estado, cfg: negocio, ahora, telefono: clave, acciones: [] };
    const historial: ModelMessage[] = conv.mensajes.slice(-12).map((m) => ({
      role: m.rol === "cliente" ? "user" : "assistant",
      content: m.texto,
    }));
    return { ctx, historial };
  });

  const llm = modeloConfigurado();
  let textoRespuesta: string;
  let motorUsado = "demo";
  if (llm) {
    try {
      textoRespuesta = await responderConLLM(ctx, historial, llm.modelo);
      motorUsado = llm.nombre;
    } catch (e) {
      console.error("[agente] Falló el LLM, uso el agente demo:", e);
      textoRespuesta = responderDemo(ctx, texto);
      motorUsado = "demo (respaldo)";
    }
  } else {
    textoRespuesta = responderDemo(ctx, texto);
  }

  const mensaje: Mensaje = conEstado((estado) => {
    const m: Mensaje = {
      id: nuevoId(estado, "msg"),
      rol: "asistente",
      texto: textoRespuesta,
      ts: Date.now(),
      pagoId: ctx.pagoGenerado?.id,
    };
    estado.conversaciones[ctx.telefono].mensajes.push(m);
    return m;
  });

  return { mensaje, motor: motorUsado, acciones: ctx.acciones };
}
