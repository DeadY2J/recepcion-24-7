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

/** Los seis momentos del guion de 60 s de PROSPECCION.md, con la voz en off de cada uno. */
const ESCENAS = [
  "Son las 23:40 y una paciente escribe a su clínica.",
  "La asistente entiende el audio y le ofrece horarios libres reales.",
  "Responde con un número y la cita se mueve sola.",
  "El hueco que quedó libre se ofrece al instante a la lista de espera. Esa hora ya no se pierde.",
  "Los pacientes nuevos reservan y dejan un anticipo para confirmar.",
  "Recepción 24/7: tu clínica contesta siempre.",
];

class Detenida extends Error {}

export default function SalaDemo() {
  const [vista, setVista] = useState<VistaPanel | null>(null);
  const [fecha, setFecha] = useState<string | undefined>();
  const [telefono, setTelefono] = useState(TELEFONOS[0].valor);
  const [pestana, setPestana] = useState<"chat" | "clinica">("chat");
  const [escribiendo, setEscribiendo] = useState(false);
  const [pendiente, setPendiente] = useState<Mensaje | null>(null);
  const ultimoCambioVisto = useRef<number>(0);
  const [escena, setEscena] = useState<number | null>(null);
  const funcion = useRef(0);

  // El guion cambia de teléfono a mitad de una función asíncrona: leemos siempre el actual.
  const telefonoActual = useRef(telefono);
  telefonoActual.current = telefono;

  const cargar = useCallback(async () => {
    const q = new URLSearchParams({ telefono: telefonoActual.current });
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

  async function enviar(texto: string, audioSegundos?: number, tel: string = telefono) {
    if (!texto.trim()) return;
    setPendiente({ id: "local", rol: "cliente", texto, ts: Date.now(), audio: audioSegundos ? { segundos: audioSegundos } : undefined });
    setEscribiendo(true);
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: tel, texto, audioSegundos }),
      });
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      setPendiente(null);
      setEscribiendo(false);
      await cargar();
    }
  }

  async function reiniciar() {
    funcion.current++;
    setEscena(null);
    await fetch("/api/demo/reiniciar", { method: "POST" });
    ultimoCambioVisto.current = 0;
    setFecha(undefined);
    setTelefono(TELEFONOS[0].valor);
    telefonoActual.current = TELEFONOS[0].valor;
    await cargar();
  }

  /**
   * Modo presentación: ejecuta el guion de 60 s sobre datos recién reiniciados.
   * Usa la misma API que una persona (chat, estado y checkout de prueba); no hay atajos en el motor.
   */
  async function presentar() {
    await reiniciar();
    const id = funcion.current;
    const esperar = async (ms: number) => {
      await new Promise((r) => setTimeout(r, ms));
      if (funcion.current !== id) throw new Detenida();
    };
    const [laura, nuevo] = [TELEFONOS[0].valor, TELEFONOS[1].valor];
    try {
      setPestana("chat");
      setEscena(0);
      await esperar(5000);
      setEscena(1);
      await enviar(GUION[0].texto, GUION[0].audio, laura);
      await esperar(8000);
      setEscena(2);
      await enviar("1", undefined, laura);
      await esperar(6000);
      // El hueco liberado se ofrece al momento; la lista de espera responde a los pocos segundos.
      setEscena(3);
      setPestana("clinica");
      mostrar("agenda");
      await esperar(12000);
      await cargar();
      setEscena(4);
      setPestana("chat");
      mostrar("arriba");
      setTelefono(nuevo);
      telefonoActual.current = nuevo;
      await enviar("Quiero agendar una cita de RPG, me duele la espalda", undefined, nuevo);
      await esperar(3000);
      await enviar("1", undefined, nuevo);
      await esperar(2500);
      await enviar("Ana Torres", undefined, nuevo);
      await esperar(2500);
      const r = await fetch(`/api/estado?${new URLSearchParams({ telefono: nuevo })}`, { cache: "no-store" });
      const v = (await r.json()) as VistaPanel;
      const pagoId = [...v.mensajes].reverse().find((m) => m.pagoId)?.pagoId;
      if (pagoId) await fetch(`/api/pagos/${pagoId}`, { method: "POST" });
      await esperar(1500);
      await cargar();
      await esperar(4000);
      setEscena(5);
      setPestana("clinica");
      await esperar(8000);
      setEscena(null);
    } catch (e) {
      if (!(e instanceof Detenida)) throw e;
    }
  }

  /** Lleva la vista a la parte del panel que cuenta la escena. */
  function mostrar(donde: "agenda" | "arriba") {
    const comportamiento: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (donde === "arriba") window.scrollTo({ top: 0, behavior: comportamiento });
    else setTimeout(() => document.getElementById("agenda")?.scrollIntoView({ behavior: comportamiento, block: "start" }), 50);
  }

  function detener() {
    funcion.current++;
    setEscena(null);
  }

  if (!vista) {
    return <main className="grid min-h-dvh place-items-center text-bruma-suave">Abriendo la clínica…</main>;
  }

  const mensajes = pendiente ? [...vista.mensajes, pendiente] : vista.mensajes;

  return (
    <main className={`mx-auto flex min-h-dvh max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-10 lg:py-8 ${escena !== null ? "pb-36" : ""}`}>
      <Encabezado vista={vista} onReiniciar={reiniciar} onPresentar={presentar} presentando={escena !== null} />

      <div className="flex gap-1 rounded-full bg-noche-alta p-1 lg:hidden" role="tablist" aria-label="Vista">
        {(["chat", "clinica"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pestana === p}
            onClick={() => setPestana(p)}
            className={`flex-1 rounded-full py-2 text-sm font-medium ${pestana === p ? "bg-menta text-noche" : "text-bruma-suave"}`}
          >
            {p === "chat" ? "Conversación" : "La clínica"}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <section className={`${pestana === "chat" ? "flex" : "hidden"} min-w-0 flex-col lg:sticky lg:top-6 lg:flex lg:self-start`} aria-label="Conversación de WhatsApp simulada">
          <Conversacion
            vista={vista}
            mensajes={mensajes}
            escribiendo={escribiendo}
            telefono={telefono}
            onTelefono={setTelefono}
            onEnviar={enviar}
          />
        </section>

        <section className={`${pestana === "clinica" ? "block" : "hidden"} min-w-0 lg:block`} aria-label="Panel de la clínica">
          <Dial vista={vista} />
          <Metricas vista={vista} />
          <Agenda vista={vista} onFecha={setFecha} />
          <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_260px]">
            <Actividad vista={vista} />
            <ListaEspera vista={vista} />
          </div>
        </section>
      </div>

      {escena !== null && <Subtitulo escena={escena} onDetener={detener} />}
    </main>
  );
}

/* ───────────── Modo presentación ───────────── */

function Subtitulo({ escena, onDetener }: { escena: number; onDetener: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-6 sm:pb-6" role="region" aria-label="Modo presentación">
      <div className="mx-auto max-w-3xl rounded-2xl bg-noche-alta/95 px-5 py-4 ring-1 ring-menta/40 backdrop-blur">
        <ol className="mb-3 flex gap-1.5" aria-label={`Escena ${escena + 1} de ${ESCENAS.length}`}>
          {ESCENAS.map((_, i) => (
            <li key={i} className={`h-1 flex-1 rounded-full ${i <= escena ? "bg-menta" : "bg-noche-borde"}`} aria-hidden />
          ))}
        </ol>
        <div className="flex items-center justify-between gap-4">
          <p className="voz text-lg leading-snug text-bruma italic sm:text-2xl" aria-live="polite">
            {ESCENAS[escena]}
          </p>
          <button onClick={onDetener} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-bruma ring-1 ring-noche-borde hover:ring-menta">
            Detener
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Encabezado ───────────── */

function Encabezado({
  vista,
  onReiniciar,
  onPresentar,
  presentando,
}: {
  vista: VistaPanel;
  onReiniciar: () => void;
  onPresentar: () => void;
  presentando: boolean;
}) {
  const h = vista.horarioHoy;
  const minutos = aMin(vista.ahora.hora);
  const abierto = !!h && minutos >= aMin(h.abre) && minutos < aMin(h.cierra);
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex items-baseline gap-3">
        <p className="titular text-2xl text-bruma sm:text-3xl">{vista.negocio.nombre}</p>
        <p className="text-sm text-bruma-suave">Recepción 24/7</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-bruma-suave">
        <p>
          <span className="cifra text-bruma">{vista.ahora.hora}</span> en {vista.negocio.ciudad},{" "}
          {abierto ? "clínica abierta" : "clínica cerrada"}
        </p>
        <p title="Motor de IA en uso">{vista.motorIA === "demo" ? "IA en modo demo, sin conexión" : `IA: ${vista.motorIA}`}</p>
        <button onClick={onReiniciar} className="rounded-full px-3 py-1.5 font-medium text-menta ring-1 ring-noche-borde hover:ring-menta">
          Reiniciar demo
        </button>
        <button
          onClick={onPresentar}
          disabled={presentando}
          className="rounded-full bg-menta px-4 py-1.5 font-semibold text-noche hover:bg-bruma disabled:opacity-60"
        >
          {presentando ? "Presentando…" : "Ver la demo de 60 s"}
        </button>
      </div>
    </header>
  );
}

function aMin(hora: string) {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/* ───────────── Conversación ───────────── */

function Conversacion({
  vista,
  mensajes,
  escribiendo,
  telefono,
  onTelefono,
  onEnviar,
}: {
  vista: VistaPanel;
  mensajes: Mensaje[];
  escribiendo: boolean;
  telefono: string;
  onTelefono: (t: string) => void;
  onEnviar: (texto: string, audio?: number) => void;
}) {
  const [texto, setTexto] = useState("");
  const [grabando, setGrabando] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const reconocimiento = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const el = lista.current;
    if (!el) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
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
    <div className="flex h-[min(820px,calc(100dvh-150px))] min-h-[560px] flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-noche-borde pb-4">
        <div>
          <h1 className="titular text-3xl leading-tight text-bruma sm:text-4xl">Escríbele a {vista.negocio.nombreAsistente}</h1>
          <p className="mt-1 text-sm text-bruma-suave" aria-live="polite">
            {escribiendo ? `${vista.negocio.nombreAsistente} está escribiendo…` : "Recepcionista con IA de la clínica, en línea a toda hora"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-bruma-suave" htmlFor="telefono">
            Escribes como
          </label>
          <select
            id="telefono"
            value={telefono}
            onChange={(e) => onTelefono(e.target.value)}
            className="rounded-lg bg-noche-alta px-3 py-1.5 text-sm text-bruma ring-1 ring-noche-borde"
          >
            {TELEFONOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={lista} className="flex-1 space-y-5 overflow-y-auto py-6 pr-1" aria-live="polite" aria-label="Mensajes">
        {mensajes.length === 0 && (
          <p className="voz max-w-md text-xl leading-relaxed text-bruma-suave">
            Prueba con un audio: toca el micrófono y pide que te pasen la cita del jueves a la tarde. Mira cómo cambia la
            agenda de la clínica.
          </p>
        )}
        {mensajes.map((m) => (
          <Linea key={m.id} m={m} vista={vista} />
        ))}
        {escribiendo && (
          <div className="flex gap-1.5 pl-5" aria-hidden>
            <span className="punto size-2 rounded-full bg-menta" />
            <span className="punto size-2 rounded-full bg-menta" />
            <span className="punto size-2 rounded-full bg-menta" />
          </div>
        )}
      </div>

      <div className="border-t border-noche-borde pt-3">
        <div className="flex gap-2 overflow-x-auto pb-3" role="group" aria-label="Mensajes de ejemplo">
          {GUION.map((g) => (
            <button
              key={g.texto}
              disabled={escribiendo}
              onClick={() => onEnviar(g.texto, g.audio)}
              className="relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-bruma ring-1 ring-noche-borde hover:ring-menta disabled:opacity-50"
            >
              {g.audio ? <IconoMicro className="size-3.5 text-menta" /> : null}
              {g.audio ? <span className="sr-only">Audio:</span> : null}
              {g.texto}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onEnviar(texto);
            setTexto("");
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un mensaje"
            aria-label="Mensaje"
            className="min-w-0 flex-1 rounded-full bg-papel px-5 py-3 text-[15px] text-tinta placeholder:text-tinta-suave"
          />
          {texto.trim() ? (
            <button type="submit" disabled={escribiendo} className="grid size-12 place-items-center rounded-full bg-menta text-noche" aria-label="Enviar">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={grabar}
              disabled={escribiendo}
              className={`grid size-12 place-items-center rounded-full ${grabando ? "bg-alerta text-noche" : "bg-menta text-noche"}`}
              aria-label={grabando ? "Detener grabación" : "Grabar audio"}
            >
              <IconoMicro className="size-5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function IconoMicro({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}

/** Onda fija del audio: barras deterministas según la duración. */
function Onda({ segundos }: { segundos: number }) {
  const barras = Array.from({ length: 22 }, (_, i) => 4 + ((i * 7 + segundos * 3) % 11));
  return (
    <svg viewBox="0 0 88 16" className="h-4 w-24" aria-hidden>
      {barras.map((h, i) => (
        <rect key={i} x={i * 4} y={(16 - h) / 2} width="2" height={h} rx="1" fill="currentColor" />
      ))}
    </svg>
  );
}

function Linea({ m, vista }: { m: Mensaje; vista: VistaPanel }) {
  const hora = new Date(m.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: vista.negocio.zonaHoraria });
  const pago = m.pagoId ? vista.pagos[m.pagoId] : undefined;

  if (m.rol === "cliente") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-papel px-4 py-2.5 text-[15px] leading-snug text-tinta">
          {m.audio && (
            <div className="mb-1 flex items-center gap-2 text-xs text-tinta-suave">
              <IconoMicro className="size-3.5 text-menta-honda" />
              <Onda segundos={m.audio.segundos} />
              <span className="cifra">0:{String(m.audio.segundos).padStart(2, "0")}</span>
              <span className="sr-only">Audio transcrito:</span>
            </div>
          )}
          <p className={`whitespace-pre-line ${m.audio ? "italic" : ""}`}>
            <Formato texto={m.texto} />
          </p>
          <span className="cifra mt-0.5 block text-right text-[11px] text-tinta-suave">{hora}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[92%] border-l-2 border-menta pl-4">
      <p className="mb-1 text-xs text-bruma-suave">
        {vista.negocio.nombreAsistente}, <span className="cifra">{hora}</span>
      </p>
      <p className="voz whitespace-pre-line text-[19px] leading-[1.5] text-bruma">
        <Formato texto={m.texto} />
      </p>
      {pago && (
        <a
          href={pago.url}
          target="_blank"
          rel="noopener"
          className="mt-3 inline-flex flex-col rounded-xl px-4 py-3 no-underline ring-1 ring-menta/60 hover:ring-menta"
        >
          <span className="text-xs text-bruma-suave">Anticipo para confirmar tu cita</span>
          <span className="cifra text-2xl font-semibold text-bruma">{moneda(pago.monto, vista)}</span>
          <span className="mt-1 text-sm font-medium text-menta">
            {pago.estado === "aprobado" ? "Pagado, cita confirmada" : "Pagar anticipo (checkout de prueba)"}
          </span>
        </a>
      )}
    </div>
  );
}

/** Interpreta *negritas* de WhatsApp. */
function Formato({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {partes.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i} className="font-semibold">{p.slice(1, -1)}</strong> : p))}
    </>
  );
}

/* ───────────── Dial de 24 horas ───────────── */

const C = 200; // centro del dial
const R = 132; // radio del anillo de horas

function polar(angulo: number, radio: number) {
  const a = ((angulo - 90) * Math.PI) / 180;
  return { x: C + radio * Math.cos(a), y: C + radio * Math.sin(a) };
}

/** Ángulo (grados) de un minuto del día: medianoche arriba, mediodía abajo. */
const anguloDe = (minutos: number) => (minutos / 1440) * 360;

function arco(desde: number, hasta: number, radio: number) {
  const a = polar(anguloDe(desde), radio);
  const b = polar(anguloDe(hasta), radio);
  const grande = hasta - desde > 720 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radio} ${radio} 0 ${grande} 1 ${b.x} ${b.y}`;
}

function Dial({ vista }: { vista: VistaPanel }) {
  const total = vista.dial.reduce((s, f) => s + f.abierta + f.cerrada, 0);
  const cerradas = vista.dial.reduce((s, f) => s + f.cerrada, 0);
  const ahora = aMin(vista.ahora.hora);
  const aguja = polar(anguloDe(ahora), R);
  const h = vista.horarioHoy;
  const reciente = vista.ultimaAtencion && Date.now() - vista.ultimaAtencion.ts < 12000 ? vista.ultimaAtencion : null;

  return (
    <figure className="mx-auto max-w-[460px]">
      <svg
        viewBox="0 0 400 400"
        className="w-full"
        role="img"
        aria-label={`Dial de 24 horas: ${total} citas atendidas este mes, ${cerradas} con la clínica cerrada. Ahora son las ${vista.ahora.hora}.`}
      >
        {/* Anillo de la noche y, encima, el horario de apertura de hoy. */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--color-noche-alta)" strokeWidth="16" />
        {h && <path d={arco(aMin(h.abre), aMin(h.cierra), R)} fill="none" stroke="var(--color-noche-borde)" strokeWidth="16" />}

        {/* Marcas de cada hora. */}
        {Array.from({ length: 24 }, (_, i) => {
          const a = polar(i * 15, R - 12);
          const b = polar(i * 15, R - (i % 6 === 0 ? 22 : 16));
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-bruma-suave)" strokeOpacity={i % 6 === 0 ? 0.9 : 0.35} strokeWidth="1.5" />;
        })}
        {[0, 6, 12, 18].map((hh) => {
          const p = polar(hh * 15, R - 36);
          return (
            <text key={hh} x={p.x} y={p.y + 4} textAnchor="middle" className="cifra" fontSize="12" fill="var(--color-bruma-suave)">
              {String(hh).padStart(2, "0")}
            </text>
          );
        })}

        {/* Una luz por cita atendida, apiladas hacia fuera en su hora. */}
        {vista.dial.map((f) => {
          const n = f.cerrada + f.abierta;
          return Array.from({ length: n }, (_, k) => {
            const cerrada = k < f.cerrada;
            const p = polar(f.hora * 15 + 7.5, R + 18 + k * 11);
            const nueva = reciente?.hora === f.hora && k === n - 1;
            return (
              <g key={`${f.hora}-${k}-${nueva ? reciente?.ts : ""}`}>
                {nueva && <circle cx={p.x} cy={p.y} r="4" fill="none" stroke="var(--color-menta)" strokeWidth="1.5" className="onda" />}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  className={nueva ? "enciende" : undefined}
                  fill={cerrada ? "var(--color-menta)" : "var(--color-bruma-suave)"}
                  fillOpacity={cerrada ? 1 : 0.55}
                />
              </g>
            );
          });
        })}

        {/* La hora de ahora en la clínica. */}
        <circle cx={aguja.x} cy={aguja.y} r="5" fill="var(--color-noche)" stroke="var(--color-menta)" strokeWidth="2" />

        <text x={C} y={C - 6} textAnchor="middle" className="titular cifra" fontSize="64" fill="var(--color-bruma)">
          {cerradas}
        </text>
        <text x={C} y={C + 20} textAnchor="middle" fontSize="13" fill="var(--color-bruma-suave)">
          citas atendidas
        </text>
        <text x={C} y={C + 37} textAnchor="middle" fontSize="13" fill="var(--color-bruma-suave)">
          con la clínica cerrada
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-bruma-suave">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-menta" aria-hidden /> clínica cerrada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-bruma-suave/60" aria-hidden /> clínica abierta
        </span>
        <span>{total} citas atendidas por la IA este mes</span>
      </figcaption>
    </figure>
  );
}

/* ───────────── Panel ───────────── */

function moneda(valor: number, vista: VistaPanel) {
  return new Intl.NumberFormat(vista.negocio.locale, { style: "currency", currency: vista.negocio.moneda, maximumFractionDigits: 0 }).format(valor);
}

function Metricas({ vista }: { vista: VistaPanel }) {
  const m = vista.metricas;
  const filas = [
    { valor: moneda(m.dineroRecuperado, vista), texto: `recuperados rellenando ${m.huecosRecuperados} citas canceladas con la lista de espera` },
    { valor: moneda(m.dineroSenas, vista), texto: `en ${m.senasCobradas} anticipos cobrados por adelantado` },
    { valor: String(m.turnosPorIA), texto: "citas reservadas o movidas por la IA" },
  ];
  return (
    <dl className="mt-8 mb-10 grid gap-x-6 gap-y-4 border-y border-noche-borde py-5 sm:grid-cols-3">
      {filas.map((f) => (
        <div key={f.texto}>
          <dt className="sr-only">{f.texto}</dt>
          <dd className="cifra titular text-2xl text-bruma">{f.valor}</dd>
          <dd className="mt-0.5 text-sm leading-snug text-bruma-suave">{f.texto}</dd>
        </div>
      ))}
    </dl>
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
    <div id="agenda" className="scroll-mt-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="titular text-2xl text-bruma">Agenda</h2>
        <p className="text-sm text-bruma-suave">
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
              className={`flex min-w-12 flex-col items-center rounded-lg px-2.5 py-1.5 ${activo ? "bg-menta text-noche" : "text-bruma-suave hover:bg-noche-alta"}`}
            >
              <span className="text-xs capitalize">{e.nombre}</span>
              <span className="cifra text-lg font-semibold">{e.num}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-12">
                <span className="sr-only">Hora</span>
              </th>
              {profesionales.map((p) => (
                <th key={p.id} scope="col" className="pb-1 text-left font-medium text-bruma">
                  <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: p.color }} aria-hidden />
                  {p.nombre}
                  <span className="block text-xs font-normal text-bruma-suave">{p.especialidad}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vista.horas.map((h) => (
              <tr key={h}>
                <th scope="row" className="cifra pr-2 text-right align-top text-sm font-medium text-bruma-suave">
                  {h}
                </th>
                {profesionales.map((p) => {
                  const t = vista.turnos.find((x) => x.hora === h && x.profesionalId === p.id);
                  const oferta = vista.ofertas.find((x) => x.hora === h && x.profesionalId === p.id);
                  if (t) {
                    const resaltado = reciente?.turnoId === t.id;
                    const nota =
                      t.estado === "pendiente_sena"
                        ? "esperando anticipo"
                        : t.origen === "lista_espera"
                          ? "desde la lista de espera"
                          : t.origen === "ia"
                            ? "vía IA"
                            : null;
                    return (
                      <td
                        key={`${p.id}-${reciente && resaltado ? reciente.ts : ""}`}
                        className={`h-12 rounded-md bg-noche-alta px-2.5 py-1.5 align-top ${resaltado ? "florece" : ""}`}
                        style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}
                      >
                        <span className="block truncate font-medium text-bruma">{t.paciente}</span>
                        <span className={`block truncate text-xs ${t.origen !== "recepcion" || t.estado === "pendiente_sena" ? "text-menta" : "text-bruma-suave"}`}>
                          {nota ? `${t.servicio}, ${nota}` : t.servicio}
                        </span>
                      </td>
                    );
                  }
                  if (oferta) {
                    return (
                      <td key={p.id} className="h-12 rounded-md border border-dashed border-menta px-2.5 py-1.5 align-top">
                        <span className="block text-xs font-medium text-menta">Hueco liberado</span>
                        <span className="block truncate text-xs text-bruma-suave">Ofrecido a {oferta.paciente}…</span>
                      </td>
                    );
                  }
                  return (
                    <td key={p.id} className="h-12 rounded-md border border-dashed border-noche-borde">
                      <span className="sr-only">Libre</span>
                    </td>
                  );
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
      <h2 className="titular mb-3 text-2xl text-bruma">Lo que hizo {vista.negocio.nombreAsistente}</h2>
      <ol className="divide-y divide-noche-borde">
        {vista.eventos.slice(0, 8).map((e) => (
          <li key={e.id} className="flex gap-3 py-2.5 text-sm">
            <span className="w-20 shrink-0 text-bruma-suave">{hace(e.ts)}</span>
            <span className={e.tipo === "hueco_recuperado" ? "text-menta" : "text-bruma"}>{e.texto}</span>
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
      <h2 className="titular mb-3 text-2xl text-bruma">Lista de espera</h2>
      <ul className="divide-y divide-noche-borde">
        {vista.espera.map((e) => (
          <li key={e.id} className="py-2.5 text-sm">
            <span className="block font-medium text-bruma">{e.paciente}</span>
            <span className="block text-xs text-bruma-suave">
              {e.servicio}, prefiere {e.preferencia === "cualquiera" ? "cualquier horario" : `la ${e.preferencia}`}
            </span>
            <span className={`mt-0.5 block text-xs ${e.estado === "esperando" ? "text-bruma-suave" : "text-menta"}`}>{estados[e.estado]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
