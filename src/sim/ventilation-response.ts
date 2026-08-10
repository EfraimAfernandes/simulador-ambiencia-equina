/**
 * ventilation-response.ts
 * 
 * Modelo de resposta de ventilação para o gêmeo digital equino.
 * 
 * Calcula como a vazão dos ventiladores, aberturas de cortinas e
 * infiltração natural afetam:
 * - Taxa de renovação de ar (ACH)
 * - Velocidade do ar local por zona
 * - Remoção de calor sensível (Q_vent)
 * - Remoção de umidade (vapor)
 * - Tempo de resposta do sistema
 * 
 * Modelo baseado em princípios de balanço de massa e energia para
 * edificações com ventilação natural e mecânica.
 */

import { RHO_AR, CP_AR } from '../domain/climate/psychrometrics.ts';

/** Parâmetros de entrada para o cálculo de ventilação */
export interface VentilationInput {
  /** Dimensões do volume de controle */
  volume: number;           // m³
  crossSectionWidth: number; // m (largura da seção transversal)
  crossSectionHeight: number; // m (altura da seção transversal)
  
  /** Ventilação mecânica (exaustores) */
  fanFlowRate: number;      // m³/h (vazão total de todos os ventiladores)
  
  /** Ventilação natural */
  curtainOpening: number;   // 0.0 a 1.0 (fração de abertura das cortinas)
  windSpeed: number;        // m/s (velocidade do vento externo)
  windAngle: number;        // graus (ângulo entre vento e eixo longo da edificação)
  
  /** Efeito chaminé (stack ventilation) */
  lanternimOpen: boolean;   // Se o lanternim está aberto
  lanternimArea: number;    // m² (área efetiva de abertura do lanternim)
  deltaTemp: number;        // °C (diferença T_int - T_ext para efeito stack)
  buildingHeight: number;   // m (pé-direito para cálculo de stack effect)
  
  /** Infiltração */
  infiltrationACH: number;  // trocas por hora base (0.3–0.5 típico)
}

/** Resultado do cálculo de ventilação */
export interface VentilationResult {
  /** Vazão total de ar em m³/s */
  totalFlowRate: number;
  
  /** Taxa de renovação de ar em ACH (trocas por hora) */
  ach: number;
  
  /** Velocidade média do ar na seção transversal (m/s) */
  meanAirSpeed: number;
  
  /** Componentes individuais de vazão (m³/s) */
  flowComponents: {
    mechanical: number;     // Ventiladores/exaustores
    curtainWind: number;    // Cortinas + vento
    stackEffect: number;    // Efeito chaminé
    infiltration: number;   // Infiltração residual
  };
  
  /** Taxa de remoção de calor sensível (W) dado deltaT */
  sensibleHeatRemoval: number;
  
  /** Taxa de remoção de umidade (kg_vapor/s) dado delta_w */
  moistureRemoval: number;
}

/**
 * Calcula a resposta de ventilação completa dado os parâmetros de entrada.
 */
export function calculateVentilationResponse(
  input: VentilationInput,
  tInt: number,
  tExt: number,
  wInt: number,
  wExt: number
): VentilationResult {
  // ─── 1. Ventilação Mecânica ──────────────────────────────────────
  const V_mechanical = input.fanFlowRate / 3600; // m³/s
  
  // ─── 2. Ventilação por Cortinas + Efeito de Vento ────────────────
  // Modelo simplificado: Q_wind = Cd × A_abertura × v_vento × cos(θ)
  // onde Cd ≈ 0.6 para aberturas retangulares
  const Cd = 0.6;
  // Área efetiva de abertura das cortinas (ambos os lados)
  const curtainHeight = input.crossSectionHeight - 1.0; // Acima da meia-parede de 1m
  const curtainLength = input.crossSectionWidth * 0.98; // 98% da largura
  const A_curtain = 2 * curtainHeight * curtainLength * input.curtainOpening; // m²
  
  const windAngleRad = (input.windAngle * Math.PI) / 180;
  const effectiveWindSpeed = Math.max(0.1, input.windSpeed * Math.abs(Math.cos(windAngleRad)));
  
  const V_curtainWind = Cd * A_curtain * effectiveWindSpeed; // m³/s
  
  // ─── 3. Efeito Chaminé (Stack Effect) ────────────────────────────
  // Q_stack = Cd × A_lanternim × sqrt(2 × g × H × ΔT / T_ext_abs)
  let V_stack = 0;
  if (input.lanternimOpen && input.deltaTemp > 0) {
    const g = 9.81; // m/s²
    const T_ext_abs = tExt + 273.15; // Kelvin
    const stackPressure = 2 * g * input.buildingHeight * input.deltaTemp / T_ext_abs;
    V_stack = Cd * input.lanternimArea * Math.sqrt(Math.max(0, stackPressure));
  }
  
  // ─── 4. Infiltração Natural ──────────────────────────────────────
  const V_infiltration = (input.infiltrationACH * input.volume) / 3600; // m³/s
  
  // ─── 5. Vazão Total ──────────────────────────────────────────────
  // Não-somatório simples: ventilação mecânica e natural podem se sobrepor
  // Usamos raiz da soma dos quadrados para componentes independentes
  // + soma direta para mecânico (sempre aditivo)
  const V_natural = Math.sqrt(
    V_curtainWind * V_curtainWind + 
    V_stack * V_stack + 
    V_infiltration * V_infiltration
  );
  const V_total = V_mechanical + V_natural; // m³/s
  
  // ─── 6. Métricas Derivadas ───────────────────────────────────────
  const ach = (V_total * 3600) / input.volume; // trocas por hora
  
  const crossArea = input.crossSectionWidth * input.crossSectionHeight;
  const meanAirSpeed = Math.max(0.05, V_total / crossArea); // m/s mínimo 0.05
  
  // ─── 7. Remoção de Calor Sensível ────────────────────────────────
  const m_dot = V_total * RHO_AR; // kg/s
  const Q_sensible = m_dot * CP_AR * 1000 * (tExt - tInt); // W (negativo = removendo calor)
  
  // ─── 8. Remoção de Umidade ───────────────────────────────────────
  const moistureRemoval = m_dot * (wExt - wInt); // kg_vapor/s (negativo = removendo umidade)
  
  return {
    totalFlowRate: V_total,
    ach,
    meanAirSpeed,
    flowComponents: {
      mechanical: V_mechanical,
      curtainWind: V_curtainWind,
      stackEffect: V_stack,
      infiltration: V_infiltration,
    },
    sensibleHeatRemoval: Q_sensible,
    moistureRemoval,
  };
}

/**
 * Estima o tempo de resposta do sistema de ventilação.
 * 
 * O tempo de resposta (τ) é o tempo para que ~63% da mudança de
 * temperatura se efetive após uma mudança na ventilação.
 * 
 * τ ≈ (m_ar × cp) / (ṁ_vent × cp) = volume / V̇_total
 * 
 * Para um galpão de 432 m³ com 6000 m³/h de vazão:
 * τ ≈ 432 / (6000/3600) ≈ 259 segundos ≈ 4.3 minutos
 * 
 * @returns Tempo de resposta em segundos
 */
export function estimateResponseTime(volume: number, totalFlowRate: number): number {
  if (totalFlowRate <= 0.001) return Infinity;
  return volume / totalFlowRate; // segundos
}

/**
 * Calcula a velocidade do ar local em uma posição específica
 * relativa a um ventilador.
 * 
 * Modelo de jato axial simplificado:
 * v(r, x) = v0 × (D/x)^n × exp(-k × (r/x)²)
 * 
 * @param distance Distância axial do ventilador (m)
 * @param radialOffset Distância radial do eixo do jato (m)
 * @param fanDiameter Diâmetro do ventilador (m)
 * @param exitVelocity Velocidade de saída do ar (m/s)
 * @returns Velocidade local do ar (m/s)
 */
export function localAirSpeed(
  distance: number,
  radialOffset: number,
  fanDiameter: number,
  exitVelocity: number
): number {
  if (distance < fanDiameter * 0.5) {
    // Muito perto: velocidade de saída uniforme
    return exitVelocity * Math.exp(-2 * (radialOffset / fanDiameter) ** 2);
  }
  
  // Zona estabelecida do jato
  const n = 0.8; // Expoente de decaimento axial
  const k = 50;  // Fator de expansão radial
  const axialDecay = (fanDiameter / distance) ** n;
  const radialDecay = Math.exp(-k * (radialOffset / distance) ** 2);
  
  return exitVelocity * axialDecay * radialDecay;
}
