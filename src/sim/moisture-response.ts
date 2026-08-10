/**
 * moisture-response.ts
 * 
 * Modelo de resposta de umidade para o gêmeo digital equino.
 * 
 * Calcula as fontes e sumidouros de vapor d'água no volume de controle:
 * - Geração metabólica pelos equinos (transpiração + respiração)
 * - Evaporação da cama (serragem, maravalha, palha)
 * - Evaporação do piso após lavagem
 * - Evaporação dos bebedouros (superfície livre)
 * - Remoção por ventilação
 * - Remoção por condensação (se T_superfície < T_orvalho)
 * 
 * Referências:
 * - ASHRAE Fundamentals (2021) — Chapter 10: Thermodynamics and Psychrometrics
 * - Turnpenny et al. (2000) — Thermal balance of livestock
 * - Nääs (1989) — Princípios de conforto térmico na produção animal
 */

import { getSatVaporPressure, P_ATM } from '../domain/climate/psychrometrics.ts';

// ─── Perfis de Atividade Metabólica ──────────────────────────────────

/** Dados metabólicos de um equino por atividade */
export interface EquineMetabolicProfile {
  /** Calor sensível produzido (W/animal) */
  sensibleHeat: number;
  /** Calor latente produzido (W/animal) — equivale à evaporação */
  latentHeat: number;
  /** Taxa de geração de vapor (kg/s por animal) */
  vaporRate: number;
  /** Consumo de água (litros/hora por animal) */
  waterIntake: number;
}

/** Perfis metabólicos por nível de atividade e faixa de temperatura */
export const EQUINE_METABOLIC_PROFILES: Record<string, EquineMetabolicProfile> = {
  'resting': {
    sensibleHeat: 600,
    latentHeat: 250,
    vaporRate: 0.00010,     // ~0.36 kg/h
    waterIntake: 2.0,       // L/h
  },
  'eating': {
    sensibleHeat: 850,
    latentHeat: 380,
    vaporRate: 0.00016,     // ~0.58 kg/h
    waterIntake: 3.0,
  },
  'light_exercise': {
    sensibleHeat: 1200,
    latentHeat: 600,
    vaporRate: 0.00025,     // ~0.90 kg/h
    waterIntake: 5.0,
  },
  'sweating': {
    sensibleHeat: 250,
    latentHeat: 1500,
    vaporRate: 0.00060,     // ~2.16 kg/h
    waterIntake: 8.0,
  },
};

// ─── Fontes de Umidade ───────────────────────────────────────────────

/**
 * Calcula a geração total de vapor pelos equinos.
 * 
 * Sob estresse térmico (T > 28°C), o cavalo redistribui a dissipação
 * de calor: reduz o sensível e aumenta o latente (sudorese).
 * 
 * @param numHorses Número de cavalos
 * @param activity Nível de atividade
 * @param tInt Temperatura interna (°C)
 * @returns Vapor gerado (kg/s) e calor sensível total (W)
 */
export function animalMoistureGeneration(
  numHorses: number,
  activity: string,
  tInt: number
): { vaporRate: number; sensibleHeat: number; latentHeat: number } {
  const profile = EQUINE_METABOLIC_PROFILES[activity] || EQUINE_METABOLIC_PROFILES['resting'];
  
  // Fator de estresse térmico: acima de 28°C, redistribui calor de sensível para latente
  let stressFactor = 1.0;
  if (tInt > 28) {
    stressFactor = 1.0 + (tInt - 28) * 0.15; // +15% de vapor por °C acima de 28
    stressFactor = Math.min(stressFactor, 3.0); // Cap em 3×
  }
  
  const vaporRate = numHorses * profile.vaporRate * stressFactor;
  const latentHeat = numHorses * profile.latentHeat * stressFactor;
  
  // Sensível diminui quando latente aumenta (conservação de energia)
  const sensibleReduction = tInt > 28 ? Math.min(0.5, (tInt - 28) * 0.05) : 0;
  const sensibleHeat = numHorses * profile.sensibleHeat * (1 - sensibleReduction);
  
  return { vaporRate, sensibleHeat, latentHeat };
}

/**
 * Calcula a evaporação da cama (serragem, palha, maravalha).
 * 
 * A taxa de evaporação depende de:
 * - Índice de umidade da cama (0 = seca, 1 = saturada)
 * - Temperatura do ar
 * - Umidade relativa do ar (déficit de pressão de vapor)
 * - Velocidade do ar sobre a superfície
 * 
 * @param beddingWetness Índice de umidade (0–1)
 * @param beddingArea Área total de cama (m²)
 * @param tInt Temperatura interna (°C)
 * @param rhInt Umidade relativa interna (%)
 * @param airSpeed Velocidade do ar sobre a cama (m/s)
 * @returns Taxa de evaporação em kg/s
 */
export function beddingEvaporation(
  beddingWetness: number,
  beddingArea: number,
  tInt: number,
  rhInt: number,
  airSpeed: number
): number {
  if (beddingWetness <= 0.01) return 0;
  
  // Déficit de pressão de vapor (DPV)
  const pSat = getSatVaporPressure(tInt);
  const pVapor = (rhInt / 100) * pSat;
  const dpv = Math.max(0, pSat - pVapor); // Pa
  
  // Coeficiente de transferência de massa (kg/(m²·s·Pa))
  // Modelo de Penman simplificado para evaporação de superfície
  const h_mass = 0.004 * (1 + 0.5 * airSpeed); // Aumenta com velocidade do ar
  
  // Taxa de evaporação
  const evapRate = h_mass * beddingArea * beddingWetness * (dpv / P_ATM);
  
  return Math.max(0, evapRate);
}

/**
 * Calcula a evaporação do piso após lavagem.
 * 
 * A lavagem cria uma lâmina d'água temporária que evapora ao longo de
 * 1-2 horas, dependendo das condições ambientais.
 * 
 * @param wetFloorArea Área de piso molhado (m²)
 * @param tInt Temperatura interna (°C)
 * @param rhInt Umidade relativa interna (%)
 * @param airSpeed Velocidade do ar (m/s)
 * @returns Taxa de evaporação em kg/s
 */
export function floorEvaporation(
  wetFloorArea: number,
  tInt: number,
  rhInt: number,
  airSpeed: number
): number {
  if (wetFloorArea <= 0) return 0;
  
  const pSat = getSatVaporPressure(tInt);
  const dpv = Math.max(0, pSat * (1 - rhInt / 100)); // Pa
  
  // Coeficiente de transferência de massa para superfície plana
  const h_mass = 0.005 * (1 + 0.7 * airSpeed);
  
  return h_mass * wetFloorArea * (dpv / P_ATM);
}

/**
 * Calcula a evaporação da superfície livre dos bebedouros.
 * 
 * @param waterSurfaceArea Área total de superfície livre de água (m²)
 * @param tWater Temperatura da água (°C)
 * @param tInt Temperatura do ar (°C)
 * @param rhInt Umidade relativa (%)
 * @returns Taxa de evaporação em kg/s
 */
export function drinkingWaterEvaporation(
  waterSurfaceArea: number,
  tWater: number,
  tInt: number,
  rhInt: number
): number {
  if (waterSurfaceArea <= 0) return 0;
  
  // Pressão de saturação na superfície da água
  const pSatWater = getSatVaporPressure(tWater);
  // Pressão de vapor no ar
  const pVaporAir = (rhInt / 100) * getSatVaporPressure(tInt);
  
  const dpv = Math.max(0, pSatWater - pVaporAir);
  
  // Coeficiente de transferência para superfície livre (menor que cama)
  const h_mass = 0.003;
  
  return h_mass * waterSurfaceArea * (dpv / P_ATM);
}

// ─── Composição Total ────────────────────────────────────────────────

/** Entrada para o cálculo de balanço de umidade */
export interface MoistureBalanceInput {
  numHorses: number;
  activity: string;
  beddingWetness: number;      // 0–1
  beddingArea: number;         // m²
  wetFloorArea: number;        // m²
  waterSurfaceArea: number;    // m² (total de bebedouros)
  waterTemperature: number;    // °C
  tInt: number;                // °C
  rhInt: number;               // %
  airSpeed: number;            // m/s
  ventilationMassFlow: number; // kg/s (ṁ da ventilação)
  wInt: number;                // kg/kg (razão de umidade interna)
  wExt: number;                // kg/kg (razão de umidade externa)
}

/** Resultado do balanço de umidade */
export interface MoistureBalanceResult {
  /** Taxa total de geração de vapor (kg/s) */
  totalGeneration: number;
  /** Taxa de remoção por ventilação (kg/s) — negativo = removendo */
  ventilationRemoval: number;
  /** Taxa líquida de acúmulo de umidade (kg/s) */
  netAccumulation: number;
  /** Componentes individuais de geração (kg/s) */
  components: {
    animalVapor: number;
    beddingEvap: number;
    floorEvap: number;
    waterEvap: number;
  };
  /** Calor sensível dos animais (W) */
  animalSensibleHeat: number;
  /** Calor latente total (W) */
  totalLatentHeat: number;
}

/**
 * Calcula o balanço de umidade completo no volume de controle.
 */
export function calculateMoistureBalance(input: MoistureBalanceInput): MoistureBalanceResult {
  // ─── Fontes de vapor ──────────────────────────────────────────────
  const animal = animalMoistureGeneration(input.numHorses, input.activity, input.tInt);
  const bedding = beddingEvaporation(
    input.beddingWetness, input.beddingArea,
    input.tInt, input.rhInt, input.airSpeed
  );
  const floor = floorEvaporation(
    input.wetFloorArea, input.tInt, input.rhInt, input.airSpeed
  );
  const water = drinkingWaterEvaporation(
    input.waterSurfaceArea, input.waterTemperature,
    input.tInt, input.rhInt
  );
  
  const totalGen = animal.vaporRate + bedding + floor + water;
  
  // ─── Remoção por ventilação ───────────────────────────────────────
  const ventRemoval = input.ventilationMassFlow * (input.wExt - input.wInt); // kg/s
  // Se wExt < wInt → negativo → removendo umidade
  
  // ─── Balanço líquido ──────────────────────────────────────────────
  const netAccum = totalGen + ventRemoval;
  
  // ─── Calor latente total (para integração no balanço de energia) ──
  const L_v = 2501000; // J/kg (calor latente de vaporização da água a ~20°C)
  const totalLatentHeat = totalGen * L_v; // W
  
  return {
    totalGeneration: totalGen,
    ventilationRemoval: ventRemoval,
    netAccumulation: netAccum,
    components: {
      animalVapor: animal.vaporRate,
      beddingEvap: bedding,
      floorEvap: floor,
      waterEvap: water,
    },
    animalSensibleHeat: animal.sensibleHeat,
    totalLatentHeat,
  };
}
