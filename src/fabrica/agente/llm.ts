/**
 * Agente con LLM real. Proveedores, por orden de preferencia:
 *  1. ANTHROPIC_API_KEY            → Claude (ANTHROPIC_MODEL, por defecto claude-haiku-5-5)
 *  2. OPENAI_COMPATIBLE_BASE_URL   → cualquier gateway compatible con OpenAI
 *                                    (OmniRoute, OpenRouter, Ollama, LM Studio…)
 * Si no hay ninguno configurado, se usa el agente demo sin conexión.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, stepCountIs, tool, type LanguageModel, type ModelMessage } from "ai";
import { z } from "zod";
import { fechaLarga, nombreDia, sumarDias } from "../agenda/tiempo";
import type { Contexto } from "./herramientas";
import { buscarHorarios, cancelarTurno, describirSlot, describirTurno, infoNegocio, misTurnos, moverTurno, reservarTurno } from "./herramientas";

export function modeloConfigurado(): { modelo: LanguageModel; nombre: string } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    const id = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
    return { modelo: anthropic(id), nombre: id };
  }
  if (process.env.OPENAI_COMPATIBLE_BASE_URL) {
    const proveedor = createOpenAICompatible({
      name: "gateway",
      baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL,
      apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    });
    const id = process.env.OPENAI_COMPATIBLE_MODEL ?? "gpt-4o-mini";
    return { modelo: proveedor(id), nombre: id };
  }
  return null;
}

function instrucciones(ctx: Contexto): string {
  const { cfg, ahora } = ctx;
  const { paciente, turnos } = misTurnos(ctx);
  const proximos = Array.from({ length: 8 }, (_, i) => {
    const f = sumarDias(ahora.fecha, i);
    return `${nombreDia(f)} = ${f}`;
  }).join(", ");
  return `Eres ${cfg.nombreAsistente}, la asistente de WhatsApp de ${cfg.nombre} (${cfg.rubro}, ${cfg.ciudad}).
Hablas en español latinoamericano neutro con tuteo ("tú", "tienes", "quieres"): sin voseo ni modismos regionales, con palabras que se entiendan en todos los países (por ejemplo "cita" en vez de "turno"). Entiendes cualquier acento y modismo regional que use el paciente (voseo, "che", "pana", "güey"…), pero siempre respondes en neutro. Eres cálida, breve y resolutiva, como una recepcionista excelente. Usa *negritas* de WhatsApp para fechas y horas y algún emoji, sin exagerar.

Ahora es ${fechaLarga(ahora.fecha)} (${ahora.fecha}), ${ahora.hora} h en ${cfg.ciudad}. Próximos días: ${proximos}.

Quien escribe: ${paciente ? `${paciente.nombre} (paciente registrado)` : "un número nuevo; pídele el nombre antes de reservar"}.
Sus citas futuras: ${turnos.length ? turnos.map((t) => `[${t.id}] ${describirTurno(cfg, t)}`).join("; ") : "ninguna"}.

Datos del negocio: ${JSON.stringify(infoNegocio(cfg))}

Reglas:
- Nunca inventes horarios: consulta siempre buscar_horarios antes de ofrecer o reservar.
- Ofrece como máximo 3 opciones numeradas (1️⃣ 2️⃣ 3️⃣). Si el paciente ya fue claro (día y hora libres), hazlo directamente.
- Al reservar se genera un link de anticipo de Mercado Pago (${cfg.senaPorcentaje}%); avisa que se descuenta del total. El link se adjunta solo, no lo escribas.
- Al mover una cita el anticipo se conserva. Al cancelar, cuenta que el lugar se ofrece a la lista de espera.
- Si piden algo médico (diagnósticos, medicación), no opines: ofrece una cita con el profesional.
- Respuestas de máximo 5 líneas.`;
}

const slotSchema = {
  fecha: z.string().describe("YYYY-MM-DD"),
  hora: z.string().describe("HH:mm"),
  profesionalId: z.string(),
};

export async function responderConLLM(ctx: Contexto, historial: ModelMessage[], modelo: LanguageModel): Promise<string> {
  const { cfg } = ctx;
  const herramientas = {
    buscar_horarios: tool({
      description: "Busca horarios libres. Sin fechas busca en los próximos 10 días.",
      inputSchema: z.object({
        fechas: z.array(z.string()).optional().describe("Fechas YYYY-MM-DD"),
        franja: z.enum(["mañana", "tarde"]).optional(),
        hora: z.string().optional().describe("HH:mm preferida"),
        profesionalId: z.string().optional(),
      }),
      execute: async (f) => buscarHorarios(ctx, { ...f, limite: 5 }).map((s) => ({ ...s, texto: describirSlot(cfg, s) })),
    }),
    reservar_cita: tool({
      description: "Reserva una cita nueva para quien escribe y genera el link de anticipo.",
      inputSchema: z.object({ ...slotSchema, servicioId: z.string(), nombre: z.string().optional() }),
      execute: async ({ fecha, hora, profesionalId, servicioId, nombre }) => {
        try {
          const { turno, pago } = reservarTurno(ctx, { slot: { fecha, hora, profesionalId }, servicioId, nombre });
          return { ok: true, turno: describirTurno(cfg, turno), sena: pago?.monto };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),
    mover_cita: tool({
      description: "Mueve una cita existente del paciente a otro horario libre.",
      inputSchema: z.object({ turnoId: z.string(), ...slotSchema }),
      execute: async ({ turnoId, fecha, hora, profesionalId }) => {
        try {
          return { ok: true, turno: describirTurno(cfg, moverTurno(ctx, turnoId, { fecha, hora, profesionalId })) };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),
    cancelar_cita: tool({
      description: "Cancela una cita del paciente.",
      inputSchema: z.object({ turnoId: z.string() }),
      execute: async ({ turnoId }) => {
        try {
          return { ok: true, turno: describirTurno(cfg, cancelarTurno(ctx, turnoId)) };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),
  };

  const r = await generateText({
    model: modelo,
    system: instrucciones(ctx),
    messages: historial,
    tools: herramientas,
    stopWhen: stepCountIs(6),
    maxRetries: 1,
  });
  return r.text.trim() || "¡Listo! ¿Te ayudo con algo más?";
}

