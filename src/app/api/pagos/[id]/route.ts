import { conEstado } from "@/fabrica/agenda/almacen";
import { aprobarPago, paciente, profesional, servicio } from "@/fabrica/agenda/motor";
import { fechaLarga } from "@/fabrica/agenda/tiempo";
import { negocio } from "@/fabrica/negocio/config";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const datos = conEstado((estado) => {
    const pago = estado.pagos.find((p) => p.id === id);
    if (!pago) return null;
    const turno = estado.turnos.find((t) => t.id === pago.turnoId);
    if (!turno) return null;
    return {
      id: pago.id,
      monto: pago.monto,
      estado: pago.estado,
      negocio: negocio.nombre,
      paciente: paciente(estado, turno.pacienteId).nombre,
      servicio: servicio(negocio, turno.servicioId).nombre,
      precio: servicio(negocio, turno.servicioId).precio,
      cuando: `${fechaLarga(turno.fecha)}, ${turno.hora} h`,
      profesional: profesional(negocio, turno.profesionalId).nombre,
    };
  });
  if (!datos) return Response.json({ error: "Pago no encontrado" }, { status: 404 });
  return Response.json(datos);
}

/** Solo para el checkout simulado de la demo. En producción confirma el webhook de Mercado Pago. */
export async function POST(_req: Request, { params }: Params) {
  if (process.env.MERCADOPAGO_ACCESS_TOKEN) return Response.json({ error: "Desactivado con Mercado Pago real" }, { status: 403 });
  const { id } = await params;
  try {
    const pago = conEstado((estado) => aprobarPago(estado, negocio, id));
    return Response.json({ ok: true, estado: pago.estado });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 404 });
  }
}
