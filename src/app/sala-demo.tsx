"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VistaPanel } from "@/fabrica/vista";

const TELEFONOS = [
  { valor: "+54 9 11 5555-0101", etiqueta: "Laura Gómez (paciente)" },
  { valor: "+54 9 11 6000-1234", etiqueta: "Número nuevo" },
];

const GUION = [
  { texto: "¿Me puedes pasar la cita del jueves a la tarde?", audio: 4 },
  { texto: "¿Cuánto sale la sesión?" },
  { texto: "Quiero agendar una cita de RPG, me duele la espalda" },
  { texto: "Quiero cancelar mi cita", audio: 3 },
];

type Mensaje = VistaPanel["mensajes"][number];

export default function SalaDemo() {
  const [vista, setVista] = useState<VistaPanel | null>(null);
  const [fecha, setFecha] = useState<string | undefined>();
  const [telefono, setTelefono] = useState(TELEFONOS[0].valor);
  const [pestana, setPestana] = useState<"chat" | "agenda">("chat");
  const [escribiendo, setEscribiendo] = useState(false);
  const [pendiente, setPendiente] = useState<Mensaje | null>(null);
  const ultimoCambioVisto = useRef<number>(0);

  const cargar = useCallback(async () => {
    const q = new URLSearchParams({ telefono });
    if (fecha) q.set("fecha", fecha);
    const r = await fetch(`/api/estado?${q}`, { cache: "no-store" });
    const v = (await r.json()) as VistaPanel;
    // Si la IA tocó una cita de otro día, saltamos a ese día para verlo.
    if (v.ultimoCambio && v.ultimoCambio.ts > ultimoCambioVisto.current) {
      ultimoCambioVisto.current = v.ultimoCambio.ts;
      if (v.ultimoCambio.fecha !== v.fecha && v.dias.includes(v.ultimoCambio.fecha)) {
        setFecha(v.ultimoCambio.fecha);
        return;
      }
    }
    setVista(v);
  }, [fecha, telefono]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 2500);
    return () => clearInterval(id);
  }, [cargar]);

  async function enviar(texto: string, audioSegundos?: number) {
    if (!texto.trim() || escribiendo) return;
    setPendiente({ id: "local", rol: "cliente", texto, ts: Date.now(), audio: audioSegundos ? { segundos: audioSegundos } : undefined });
    setEscribiendo(true);
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, texto, audioSegundos }),
      });
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      setPendiente(null);
      setEscribiendo(false);
      await cargar();
    }
  }

  async function reiniciar() {
    await fetch("/api/demo/reiniciar", { method: "POST" });
    ultimoCambioVisto.current = 0;
    setFecha(undefined);
    await cargar();
  }

  if (!vista) {
    return <main className="grid min-h-dvh place-items-center text-tinta-suave">Abriendo la clínica…</main>;
  }

  const mensajes = pendiente ? [...vista.mensajes, pendiente] : vista.mensajes;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-6 px-4 py-6 lg:px-8">
      <Encabezado vista={vista} onReiniciar={reiniciar} />

      <div className="flex rounded-full bg-salvia p-1 lg:hidden" role="tablist">
        {(["chat", "agenda"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pestana === p}
            onClick={() => setPestana(p)}
            className={`flex-1 rounded-full py-2 text-sm font-medium ${pestana === p ? "bg-white shadow-sm" : "text-tinta-suave"}`}
          >
            {p === "chat" ? "WhatsApp del paciente" : "Agenda de la clínica"}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-8 lg:grid-cols-[400px_1fr]">
        <section className={`${pestana === "chat" ? "block" : "hidden"} lg:block`} aria-label="Chat de WhatsApp simulado">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-sm text-tinta-suave" htmlFor="telefono">
              Escribes como
            </label>
            <select
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="rounded-lg border border-salvia-borde bg-white px-3 py-1.5 text-sm"
            >
              {TELEFONOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <Telefono
            vista={vista}
            mensajes={mensajes}
            escribiendo={escribiendo}
            onEnviar={enviar}
          />
        </section>

        <section className={`${pestana === "agenda" ? "block" : "hidden"} min-w-0 lg:block`} aria-label="Panel de la clínica">
          <Metricas vista={vista} />
          <Agenda vista={vista} onFecha={setFecha} />
          <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_320px]">
            <Actividad vista={vista} />
            <ListaEspera vista={vista} />
          </div>
        </section>
      </div>
    </main>
  );
}

/* ───────────── Encabezado ───────────── */

function Encabezado({ vista, onReiniciar }: { vista: VistaPanel; onReiniciar: () => void }) {
  const minutos = Number(vista.ahora.hora.slice(0, 2)) * 60 + Number(vista.ahora.hora.slice(3));
  const abierto = minutos >= 8 * 60 && minutos < 20 * 60;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-salvia-borde pb-5">
      <div>
        <h1 className="cifra text-4xl font-bold text-bosque sm:text-5xl">{vista.negocio.nombre}</h1>
        <p className="mt-1 max-w-xl text-tinta-suave">
          Escribile a {vista.negocio.nombreAsistente}, su recepcionista con IA, y mirá cómo cambia la agenda real de la clínica.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-salvia-borde">
          En {vista.negocio.ciudad} son las <strong className="font-semibold">{vista.ahora.hora}</strong>
          {abierto ? " · la clínica está abierta" : " · la clínica está cerrada, Sofi no"}
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-salvia-borde" title="Motor de IA en uso">
          IA: {vista.motorIA === "demo" ? "modo demo sin conexión" : vista.motorIA}
        </span>
        <button onClick={onReiniciar} className="rounded-full px-3 py-1.5 font-medium text-bosque underline-offset-4 hover:underline">
          Reiniciar demo
        </button>
      </div>
    </header>
  );
}

/* ───────────── Teléfono ───────────── */

function Telefono({
  vista,
  mensajes,
  escribiendo,
  onEnviar,
}: {
  vista: VistaPanel;
  mensajes: Mensaje[];
  escribiendo: boolean;
  onEnviar: (texto: string, audio?: number) => void;
}) {
  const [texto, setTexto] = useState("");
  const [grabando, setGrabando] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const reconocimiento = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [mensajes.length, escribiendo]);

  function grabar() {
    type SR = new () => {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Clase = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Clase) {
      // Sin reconocimiento de voz (Firefox/Safari): mandamos el audio de ejemplo del guion.
      onEnviar(GUION[0].texto, GUION[0].audio);
      return;
    }
    if (grabando) {
      reconocimiento.current?.stop();
      return;
    }
    const r = new Clase();
    r.lang = "es-AR";
    r.interimResults = false;
    const inicio = Date.now();
    r.onresult = (e) => {
      const dicho = e.results[0]?.[0]?.transcript ?? "";
      if (dicho) onEnviar(dicho, Math.max(1, Math.round((Date.now() - inicio) / 1000)));
    };
    r.onend = () => setGrabando(false);
    r.onerror = () => setGrabando(false);
    reconocimiento.current = r;
    setGrabando(true);
    r.start();
  }

  return (
    <div className="mx-auto flex h-[min(760px,calc(100dvh-180px))] min-h-[560px] max-w-[400px] flex-col overflow-hidden rounded-[2.5rem] border-[10px] border-tinta bg-tinta shadow-[0_30px_60px_-20px_rgb(24_34_30/0.45)]">
      <div className="flex items-center gap-3 bg-bosque px-4 py-3 text-white">
        <div className="grid size-10 place-items-center rounded-full bg-jacaranda text-sm font-bold" aria-hidden>
          KP
        </div>
        <div className="leading-tight">
          <p className="font-semibold">{vista.negocio.nombre}</p>
          <p className="text-xs text-white/75">{escribiendo ? `${vista.negocio.nombreAsistente} está escribiendo…` : "en línea"}</p>
        </div>
      </div>

      <div ref={lista} className="fondo-chat flex-1 space-y-2 overflow-y-auto px-3 py-4" aria-live="polite">
        {mensajes.length === 0 && (
          <p className="mx-auto mt-6 max-w-[260px] rounded-lg bg-white/80 px-3 py-2 text-center text-xs text-tinta-suave">
            Prueba con un audio: toca el micrófono y pide, por ejemplo, que te pasen la cita del jueves a la tarde.
          </p>
        )}
        {mensajes.map((m) => (
          <Burbuja key={m.id} m={m} vista={vista} />
        ))}
        {escribiendo && (
          <div className="w-fit rounded-xl rounded-tl-sm bg-white px-4 py-3 shadow-sm" aria-label="Escribiendo">
            <span className="punto inline-block size-1.5 rounded-full bg-tinta-suave" />{" "}
            <span className="punto inline-block size-1.5 rounded-full bg-tinta-suave" />{" "}
            <span className="punto inline-block size-1.5 rounded-full bg-tinta-suave" />
          </div>
        )}
      </div>

      <div className="bg-papel px-2 pt-2">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {GUION.map((g) => (
            <button
              key={g.texto}
              disabled={escribiendo}
              onClick={() => onEnviar(g.texto, g.audio)}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs text-tinta ring-1 ring-salvia-borde hover:ring-bosque disabled:opacity-50"
            >
              {g.audio ? "🎤 " : ""}
              {g.texto}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            onEnviar(texto);
            setTexto("");
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí un mensaje"
            aria-label="Mensaje"
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-sm ring-1 ring-salvia-borde"
          />
          {texto.trim() ? (
            <button type="submit" disabled={escribiendo} className="grid size-10 place-items-center rounded-full bg-bosque text-white" aria-label="Enviar">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={grabar}
              disabled={escribiendo}
              className={`grid size-10 place-items-center rounded-full text-white ${grabando ? "bg-alerta" : "bg-bosque"}`}
              aria-label={grabando ? "Detener grabación" : "Grabar audio"}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function Burbuja({ m, vista }: { m: Mensaje; vista: VistaPanel }) {
  const mio = m.rol === "cliente";
  const hora = new Date(m.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: vista.negocio.zonaHoraria });
  const pago = m.pagoId ? vista.pagos[m.pagoId] : undefined;
  return (
    <div className={`flex ${mio ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[14px] leading-snug shadow-sm ${mio ? "rounded-tr-sm bg-burbuja" : "rounded-tl-sm bg-white"}`}>
        {m.audio && (
          <div className="mb-1 flex items-center gap-2 text-xs text-tinta-suave">
            <span aria-hidden>🎤</span>
            <span className="h-1 w-24 rounded-full bg-bosque/30" aria-hidden />
            <span>0:{String(m.audio.segundos).padStart(2, "0")}</span>
            <span className="sr-only">Audio transcrito:</span>
          </div>
        )}
        <p className={`whitespace-pre-line ${m.audio ? "italic text-tinta-suave" : ""}`}>
          <Formato texto={m.texto} />
        </p>
        {pago && (
          <a
            href={pago.url}
            target="_blank"
            className="mt-2 block rounded-lg border border-salvia-borde bg-papel p-3 no-underline hover:border-bosque"
          >
            <span className="block text-xs text-tinta-suave">Anticipo para confirmar tu cita</span>
            <span className="cifra block text-2xl font-bold text-bosque">{moneda(pago.monto, vista)}</span>
            <span className={`mt-1 block text-sm font-medium ${pago.estado === "aprobado" ? "text-bosque-claro" : "text-jacaranda"}`}>
              {pago.estado === "aprobado" ? "✓ Pagado, cita confirmada" : "Pagar con Mercado Pago"}
            </span>
          </a>
        )}
        <span className="mt-0.5 block text-right text-[10px] text-tinta-suave">{hora}</span>
      </div>
    </div>
  );
}

/** Interpreta *negritas* de WhatsApp. */
function Formato({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {partes.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i}>{p.slice(1, -1)}</strong> : p))}
    </>
  );
}

/* ───────────── Panel ───────────── */

function moneda(valor: number, vista: VistaPanel) {
  return new Intl.NumberFormat(vista.negocio.locale, { style: "currency", currency: vista.negocio.moneda, maximumFractionDigits: 0 }).format(valor);
}

function Metricas({ vista }: { vista: VistaPanel }) {
  const m = vista.metricas;
  return (
    <div className="mb-8 grid grid-cols-3 gap-x-4 gap-y-6 border-b border-salvia-borde pb-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div className="col-span-3 sm:col-span-1">
        <p className="cifra text-5xl font-bold text-jacaranda sm:text-6xl">{moneda(m.dineroRecuperado, vista)}</p>
        <p className="mt-1 text-sm text-tinta-suave">
          recuperados este mes rellenando {m.huecosRecuperados} citas canceladas con la lista de espera
        </p>
      </div>
      <Dato valor={moneda(m.dineroSenas, vista)} texto={`en ${m.senasCobradas} anticipos cobrados por adelantado`} />
      <Dato valor={String(m.turnosPorIA)} texto="citas reservadas o movidas por la IA" />
      <Dato valor={String(m.fueraDeHorario)} texto="pacientes atendidos con la clínica cerrada" />
    </div>
  );
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div>
      <p className="cifra text-2xl font-bold text-bosque sm:text-3xl">{valor}</p>
      <p className="mt-1 text-sm text-tinta-suave">{texto}</p>
    </div>
  );
}

function Agenda({ vista, onFecha }: { vista: VistaPanel; onFecha: (f: string) => void }) {
  const profesionales = vista.negocio.profesionales;
  const reciente = vista.ultimoCambio && Date.now() - vista.ultimoCambio.ts < 12000 ? vista.ultimoCambio : null;
  const etiquetaDia = (f: string) => {
    const d = new Date(`${f}T12:00:00Z`);
    const nombre = d.toLocaleDateString("es-AR", { weekday: "short", timeZone: "UTC" });
    return { nombre: f === vista.ahora.fecha ? "hoy" : nombre.replace(".", ""), num: d.getUTCDate() };
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold">Agenda</h2>
        <p className="text-sm text-tinta-suave">
          {vista.turnos.length} de {vista.horas.length * profesionales.length} citas ocupadas
        </p>
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="Día">
        {vista.dias.map((f) => {
          const e = etiquetaDia(f);
          const activo = f === vista.fecha;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={activo}
              onClick={() => onFecha(f)}
              className={`flex min-w-14 flex-col items-center rounded-xl px-3 py-2 ${activo ? "bg-bosque text-white" : "hover:bg-salvia"}`}
            >
              <span className="text-xs capitalize">{e.nombre}</span>
              <span className="cifra text-xl font-bold">{e.num}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-14" />
              {profesionales.map((p) => (
                <th key={p.id} scope="col" className="pb-1 text-left font-medium">
                  <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: p.color }} aria-hidden />
                  {p.nombre}
                  <span className="block text-xs font-normal text-tinta-suave">{p.especialidad}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vista.horas.map((h) => (
              <tr key={h}>
                <th scope="row" className="cifra pr-2 text-right align-top text-base font-semibold text-tinta-suave">
                  {h}
                </th>
                {profesionales.map((p) => {
                  const t = vista.turnos.find((x) => x.hora === h && x.profesionalId === p.id);
                  const oferta = vista.ofertas.find((x) => x.hora === h && x.profesionalId === p.id);
                  if (t) {
                    const resaltado = reciente?.turnoId === t.id;
                    return (
                      <td
                        key={`${p.id}-${reciente && resaltado ? reciente.ts : ""}`}
                        className={`h-14 rounded-lg border-l-4 bg-white px-2.5 py-1.5 align-top ${resaltado ? "florece" : ""}`}
                        style={{ borderLeftColor: p.color }}
                      >
                        <span className="block truncate font-medium">{t.paciente}</span>
                        <span className="block truncate text-xs text-tinta-suave">
                          {t.servicio}
                          {t.estado === "pendiente_sena" && " · esperando anticipo"}
                          {t.origen === "lista_espera" && " · desde lista de espera"}
                          {t.origen === "ia" && t.estado !== "pendiente_sena" && " · vía IA"}
                        </span>
                      </td>
                    );
                  }
                  if (oferta) {
                    return (
                      <td key={p.id} className="h-14 rounded-lg border border-dashed border-jacaranda bg-jacaranda-claro/60 px-2.5 py-1.5 align-top">
                        <span className="block text-xs font-medium text-jacaranda">Hueco liberado</span>
                        <span className="block truncate text-xs text-tinta-suave">Ofrecido a {oferta.paciente}…</span>
                      </td>
                    );
                  }
                  return <td key={p.id} className="h-14 rounded-lg border border-dashed border-salvia-borde" aria-label="Libre" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hace(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

function Actividad({ vista }: { vista: VistaPanel }) {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">Lo que hizo Sofi</h2>
      <ol className="divide-y divide-salvia-borde">
        {vista.eventos.slice(0, 10).map((e) => (
          <li key={e.id} className="flex gap-3 py-2.5 text-sm">
            <span className="w-20 shrink-0 text-tinta-suave">{hace(e.ts)}</span>
            <span className={e.tipo === "hueco_recuperado" ? "font-medium text-jacaranda" : ""}>{e.texto}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ListaEspera({ vista }: { vista: VistaPanel }) {
  const estados = { esperando: "Esperando lugar", ofrecido: "Se le ofreció un hueco", asignado: "Ya tiene cita" } as const;
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">Lista de espera</h2>
      <ul className="space-y-2">
        {vista.espera.map((e) => (
          <li key={e.id} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-salvia-borde">
            <span className="block font-medium">{e.paciente}</span>
            <span className="block text-xs text-tinta-suave">
              {e.servicio}, prefiere {e.preferencia === "cualquiera" ? "cualquier horario" : `la ${e.preferencia}`}
            </span>
            <span className={`mt-1 block text-xs font-medium ${e.estado === "esperando" ? "text-tinta-suave" : "text-jacaranda"}`}>
              {estados[e.estado]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
