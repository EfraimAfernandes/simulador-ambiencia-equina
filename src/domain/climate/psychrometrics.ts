/**
 * Psicrometria e Índices de Conforto Térmico para Equinos
 */

// Pressão atmosférica padrão ao nível do mar (Pa)
export const P_ATM = 101325; 

// Calor específico do ar seco (kJ/kg·K)
export const CP_AR = 1.006; 

// Densidade padrão do ar (kg/m³)
export const RHO_AR = 1.2;

/**
 * Calcula a pressão de vapor de saturação (Pa) para uma dada temperatura (°C)
 * Usando a equação de Tetens
 */
export function getSatVaporPressure(temp: number): number {
  return 610.78 * Math.exp((17.27 * temp) / (temp + 237.3));
}

/**
 * Calcula a razão de mistura / umidade absoluta (kg vapor / kg ar seco)
 * dada a temperatura (°C) e a umidade relativa (%)
 */
export function getHumidityRatio(temp: number, rh: number): number {
  const pSat = getSatVaporPressure(temp);
  const pVapor = (rh / 100) * pSat;
  // Evitar divisão por zero caso pVapor chegue perto de P_ATM
  const pVaporClamp = Math.min(pVapor, P_ATM * 0.95);
  return (0.622 * pVaporClamp) / (P_ATM - pVaporClamp);
}

/**
 * Calcula a umidade relativa (%) dada a temperatura (°C) e a razão de umidade (kg/kg)
 */
export function getRelativeHumidity(temp: number, w: number): number {
  const pSat = getSatVaporPressure(temp);
  const pVapor = (w * P_ATM) / (0.622 + w);
  const rh = (pVapor / pSat) * 100;
  return Math.min(100, Math.max(0, rh));
}

/**
 * Calcula a entalpia do ar úmido (kJ / kg ar seco)
 * dada a temperatura (°C) e a razão de umidade (kg/kg)
 * h = cp_ar * T + w * (h_fg + cp_vapor * T)
 */
export function getEnthalpy(temp: number, w: number): number {
  return CP_AR * temp + w * (2501 + 1.86 * temp);
}

/**
 * Calcula o Índice de Temperatura e Umidade (ITU / THI) pela fórmula de Thom (1959)
 * Muito utilizada para bioclimatologia animal geral.
 */
export function getThomTHI(temp: number, rh: number): number {
  return 0.8 * temp + (rh / 100) * (temp - 14.3) + 46.4;
}

/**
 * Calcula o índice clássico de conforto térmico específico para cavalos:
 * Temp (°F) + Umidade Relativa (%)
 * 
 * Classificação:
 * - < 130: Conforto ideal (mecanismos normais de dissipação funcionam perfeitamente).
 * - 130 a 150: Alerta moderado (o cavalo consegue suar, mas requer atenção, beber mais água).
 * - > 150: Estresse grave (a capacidade de resfriamento evaporativo diminui drasticamente, perigo de insolação).
 */
export function getEquineComfortIndex(temp: number, rh: number): { index: number; status: 'COGNITIVE' | 'WARNING' | 'DANGER'; label: string } {
  const tempF = temp * 1.8 + 32;
  const index = tempF + rh;
  
  if (index < 130) {
    return { index, status: 'COGNITIVE', label: 'Conforto Térmico' };
  } else if (index < 150) {
    return { index, status: 'WARNING', label: 'Alerta / Estresse Leve' };
  } else {
    return { index, status: 'DANGER', label: 'Estresse Térmico Grave!' };
  }
}
