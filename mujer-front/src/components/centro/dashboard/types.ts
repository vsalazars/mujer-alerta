export type ResumenGlobal = {
  frecuencia: number;
  normalidad: number;
  gravedad: number;
  total: number;
};

export type MatrizItem = {
  tipo_num: number;
  tipo_nombre: string;
  dimension: "frecuencia" | "normalidad" | "gravedad";
  promedio: number;
};

export type CountItem = { clave: string; label: string; total: number };

export type GeneroDimItem = {
  clave: string;
  label: string;
  frecuencia: number;
  normalidad: number;
  gravedad: number;
};

export type ComentarioItem = {
  encuesta_id: string;
  analisis_id: number;
  fecha: string;
  genero: string;
  edad: number;
  texto: string;
  estado: string;
  resumen: string;
  sentimiento_label: string;
  sentimiento_score: number;
  emocion_label: string;
  emocion_score: number;
  keywords: string[];
  tema_clave: string;
  tema_etiqueta: string;
  tema_score: number;
  confianza_general: number;
  pipeline_version: string;
};

export type NLPStats = {
  total_comentarios: number;
  total_procesados: number;
  total_pendientes: number;
  total_error: number;
  por_sentimiento: CountItem[];
  por_emocion: CountItem[];
  por_tema: CountItem[];
};

export type CentroStats = {
  total_participantes: number;
  total_encuestas: number;
  total_respuestas: number;
  encuestas_por_genero: CountItem[];
  respuestas_por_genero: CountItem[];
  encuestas_por_edad: CountItem[];
  respuestas_por_edad: CountItem[];
  resumen_por_genero: GeneroDimItem[];
  comentarios?: ComentarioItem[];
  nlp: NLPStats;
};

export type CentroResumenResponse = {
  centros: number[];
  global: ResumenGlobal;
  matriz: MatrizItem[];
  stats: CentroStats;
};

export type AdvRow = {
  dimension: "frecuencia" | "normalidad" | "gravedad" | string;
  n_respuestas: number;
  n_encuestas: number;
  total_respuestas: number;
  k_items: number;
  promedio: number;
  std_dev: number;
  mediana: number;
  p25: number;
  p75: number;
  ic95_inferior: number;
  ic95_superior: number;
  alpha_cronbach: number;
  std_dev_encuestas: number;
  ic95_inferior_encuestas: number;
  ic95_superior_encuestas: number;
};

export type CentroEstadisticaAvanzadaResponse = {
  centros: number[];
  year: number;
  datos: AdvRow[];
};

export type YearOption = { value: string; label: string };

export type Semantic5 = "Muy bajo" | "Bajo" | "Medio" | "Alto" | "Muy alto";
export type LevelTag = "Muy bajo" | "Bajo" | "Medio" | "Alto" | "Muy alto";
export type VarTag = "Baja" | "Moderada" | "Alta";
export type PrecTag = "Alta" | "Moderada" | "Baja";
export type ConsTag = "Baja" | "Aceptable" | "Alta" | "Muy alta";
