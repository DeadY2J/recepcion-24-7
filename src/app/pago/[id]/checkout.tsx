"use client";

import { useEffect, useState } from "react";

type Datos = {
  id: string;
  monto: number;
  estado: "pendiente" | "aprobado";
  negocio: string;
  paciente: string;
  servicio: string;
  precio: number;
  cuando: string;
  profesional: string;
};

const ars = (v: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v);

/**
 * Checkout de PRUEBA. Simula el paso por Mercado Pago sin pedir datos de tarjeta.
 * Con MERCADOPAGO_ACCESS_TOKEN configurado, el paciente va al Checkout Pro real.
 */
export default function Checkout({ id }: { id: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    fetch(`/api/pagos/${id}`)
      .then(async (r) => (r.ok ? setDatos(await r.json()) : setError("Este link de pago no existe o venció. Pedile uno nuevo a la clínica por WhatsApp.")))
      .catch(() => setError("No pudimos cargar el pago. Revisá tu conexión y recargá la página."));
  }, [id]);

  async function pagar() {
    setPagando(true);
    await new Promise((r) => setTimeout(r, 900));
    const r = await fetch(`/api/pagos/${id}`, { method: "POST" });
    if (r.ok && datos) setDatos({ ...datos, estado: "aprobado" });
    else setError("El pago no se pudo completar. Inténtalo de nuevo.");
    setPagando(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="mb-6 rounded-lg bg-jacaranda-claro px-3 py-2 text-sm text-jacaranda">
        Checkout de prueba: simula Mercado Pago, no se cobra nada.
      </p>
      {error && <p className="text-alerta">{error}</p>}
      {!datos && !error && <p className="text-tinta-suave">Cargando el pago…</p>}
      {datos && (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-salvia-borde">
          <p className="text-sm text-tinta-suave">{datos.negocio}</p>
          <h1 className="mt-1 text-2xl font-semibold">Anticipo de tu cita</h1>
          <p className="cifra mt-4 text-6xl font-bold text-bosque">{ars(datos.monto)}</p>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-tinta-suave">Paciente</dt><dd>{datos.paciente}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-tinta-suave">Servicio</dt><dd className="text-right">{datos.servicio}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-tinta-suave">Cuándo</dt><dd className="text-right">{datos.cuando}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-tinta-suave">Con</dt><dd>{datos.profesional}</dd></div>
            <div className="flex justify-between gap-4 border-t border-salvia-borde pt-2"><dt className="text-tinta-suave">Resta pagar en la clínica</dt><dd>{ars(datos.precio - datos.monto)}</dd></div>
          </dl>
          {datos.estado === "aprobado" ? (
            <p className="mt-6 rounded-xl bg-salvia px-4 py-3 font-medium text-bosque">
              Anticipo pagado. Tu cita quedó confirmada y ya lo ves en la agenda de la clínica.
            </p>
          ) : (
            <button
              onClick={pagar}
              disabled={pagando}
              className="mt-6 w-full rounded-xl bg-bosque py-3.5 font-semibold text-white hover:bg-bosque-claro disabled:opacity-60"
            >
              {pagando ? "Procesando el pago…" : `Pagar ${ars(datos.monto)}`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
