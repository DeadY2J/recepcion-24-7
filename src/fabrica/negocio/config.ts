/**
 * Configuración del negocio. Es lo ÚNICO que cambia entre un cliente y otro:
 * para un encargo nuevo se duplica este archivo y se ajustan nombre, servicios,
 * profesionales y horarios. El resto de la Fábrica se reutiliza tal cual.
 */

export type Servicio = {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: number; // en moneda local
  descripcion: string;
};

export type Profesional = {
  id: string;
  nombre: string;
  especialidad: string;
  color: string; // para el panel
};

export type Horario = { abre: string; cierra: string } | null; // null = cerrado

export type ConfigNegocio = {
  slug: string;
  nombre: string;
  rubro: string;
  ciudad: string;
  direccion: string;
  telefonoWhatsApp: string;
  zonaHoraria: string;
  locale: string;
  moneda: string;
  /** Porcentaje del precio que se cobra como seña para confirmar la cita. */
  senaPorcentaje: number;
  /** Cómo habla el asistente: siempre español latinoamericano neutro con tuteo, sin voseo ni modismos regionales. */
  registro: "tuteo";
  nombreAsistente: string;
  obrasSociales: string[];
  servicios: Servicio[];
  profesionales: Profesional[];
  /** 0 = domingo … 6 = sábado */
  horarios: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Horario>;
  /** Cada cuántos minutos se ofrecen citas. */
  intervaloMin: number;
};

export const kinesioPalermo: ConfigNegocio = {
  slug: "kinesio-palermo",
  nombre: "Kinesio Palermo",
  rubro: "Kinesiología y fisioterapia",
  ciudad: "Buenos Aires",
  direccion: "Av. Santa Fe 3842, 2º B, Palermo, CABA",
  telefonoWhatsApp: "+54 9 11 4000-3842",
  zonaHoraria: "America/Argentina/Buenos_Aires",
  locale: "es-AR",
  moneda: "ARS",
  senaPorcentaje: 30,
  registro: "tuteo",
  nombreAsistente: "Sofi",
  obrasSociales: ["OSDE", "Swiss Medical", "Galeno", "Medifé"],
  servicios: [
    {
      id: "kine",
      nombre: "Sesión de kinesiología",
      duracionMin: 45,
      precio: 28000,
      descripcion: "Rehabilitación, contracturas, lesiones deportivas y post-operatorio.",
    },
    {
      id: "rpg",
      nombre: "RPG (reeducación postural)",
      duracionMin: 60,
      precio: 34000,
      descripcion: "Para dolor de espalda crónico, cervicales y postura.",
    },
    {
      id: "deportiva",
      nombre: "Evaluación deportiva",
      duracionMin: 60,
      precio: 38000,
      descripcion: "Evaluación completa y plan de prevención para corredores y deportistas.",
    },
  ],
  profesionales: [
    { id: "lic-romero", nombre: "Lic. Martina Romero", especialidad: "Deportiva", color: "#0f766e" },
    { id: "lic-paz", nombre: "Lic. Tomás Paz", especialidad: "Traumatología", color: "#b45309" },
    { id: "lic-iglesias", nombre: "Lic. Carla Iglesias", especialidad: "RPG y postura", color: "#7c3aed" },
  ],
  horarios: {
    0: null,
    1: { abre: "08:00", cierra: "20:00" },
    2: { abre: "08:00", cierra: "20:00" },
    3: { abre: "08:00", cierra: "20:00" },
    4: { abre: "08:00", cierra: "20:00" },
    5: { abre: "08:00", cierra: "19:00" },
    6: { abre: "09:00", cierra: "13:00" },
  },
  intervaloMin: 60,
};

export const negocio = kinesioPalermo;
