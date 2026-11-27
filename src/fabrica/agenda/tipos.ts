export type Franja = "mañana" | "tarde" | "noche";

export type Paciente = {
  id: string;
  nombre: string;
  telefono: string;
  obraSocial?: string;
};

export type Slot = { fecha: string; hora: string; profesionalId: string };

export type EstadoTurno = "pendiente_sena" | "confirmado" | "cancelado";
export type OrigenTurno = "ia" | "recepcion" | "lista_espera";

export type Turno = Slot & {
  id: string;
  pacienteId: string;
  servicioId: string;
  estado: EstadoTurno;
  senaPagada: boolean;
  origen: OrigenTurno;
  creadoEn: number;
};

export type EsperaItem = {
  id: string;
  pacienteId: string;
  servicioId: string;
  preferencia: Franja | "cualquiera";
  estado: "esperando" | "ofrecido" | "asignado";
  oferta?: Slot;
  ofrecidoEn?: number;
};

export type Pago = {
  id: string;
  turnoId: string;
  monto: number;
  estado: "pendiente" | "aprobado";
  proveedor: "demo" | "mercadopago";
  url: string;
};

export type TipoEvento =
  | "turno_reservado"
  | "turno_movido"
  | "turno_cancelado"
  | "sena_cobrada"
  | "hueco_ofrecido"
  | "hueco_recuperado"
  | "mensaje_fuera_de_horario"
  | "consulta_respondida";

export type Evento = {
  id: string;
  ts: number;
  tipo: TipoEvento;
  texto: string;
  monto?: number;
  porIA: boolean;
};

export type Mensaje = {
  id: string;
  rol: "cliente" | "asistente";
  texto: string;
  ts: number;
  audio?: { segundos: number };
  pagoId?: string;
};

export type EstadoConversacion = {
  ofrecidos?: Slot[];
  accion?: "reservar" | "mover";
  turnoAMoverId?: string;
  servicioId?: string;
  /** Turno elegido por un número nuevo, a la espera de que diga su nombre. */
  esperandoNombre?: { slot: Slot; servicioId: string };
};

export type Conversacion = {
  telefono: string;
  mensajes: Mensaje[];
  memoria: EstadoConversacion;
};

export type Estado = {
  pacientes: Paciente[];
  turnos: Turno[];
  espera: EsperaItem[];
  pagos: Pago[];
  eventos: Evento[];
  conversaciones: Record<string, Conversacion>;
  secuencia: number;
  /** Último turno tocado, para resaltarlo en el panel. */
  ultimoCambio?: { turnoId: string; fecha: string; ts: number; tipo: TipoEvento };
};
