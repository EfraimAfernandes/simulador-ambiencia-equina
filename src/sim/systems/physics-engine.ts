import { ControlVolume } from '../state/control-volume.ts';
import { getHumidityRatio, getRelativeHumidity, RHO_AR, CP_AR } from '../../domain/climate/psychrometrics.ts';
import { calculateVentilationResponse } from '../ventilation-response.ts';
import { calculateMoistureBalance } from '../moisture-response.ts';

export interface PhysicsParams {
  T_ext: number;          // Temperatura externa (°C)
  RH_ext: number;         // Umidade relativa externa (%)
  solarRadiation: number; // Radiação solar incidente (W/m²)
  numHorses: number;      // Número de cavalos
  horseActivity: 'resting' | 'eating' | 'sweating'; // Nível de atividade metabólica
  fanFlowRate: number;    // Vazão do exaustor mecânico (m³/h)
  beddingWetness: number; // Índice de umidade da cama (0 = seca, 1 = muito úmida)
  curtainOpening: number; // Abertura das cortinas (0 = fechada, 1 = aberta)
  timeScale: number;      // Fator de aceleração temporal (ex: 60 = 1s real equivale a 1min sim)
  structuralPreset?: 'traditional' | 'premium'; // Preset construtivo
}

export class PhysicsEngine {
  /**
   * Executa a simulação física por um passo de tempo dt (em segundos)
   */
  public static update(cv: ControlVolume, dtReal: number, params: PhysicsParams): void {
    const timeScale = params.timeScale;
    const dtSim = dtReal * timeScale;
    
    // Forçar sincronia do preset estrutural
    if (params.structuralPreset) {
      cv.structuralPreset = params.structuralPreset;
    }
    
    // Configurações físicas derivadas do Preset Construtivo
    const isPremium = cv.structuralPreset === 'premium';
    
    // Tradicional: envelope permeável, alta ganho solar, ventilação natural limitada
    // Premium: vedação, baixo ganho solar, mínima infiltração
    const baseInfiltration = isPremium ? 0.18 : 0.75;
    const effectiveWindSpeed = isPremium ? 0.45 : 1.4;
    const lanternimIsOpen = !isPremium;
    
    // Inércia: premium amortece oscilações; tradicional transmite calor do telhado
    const thermalInertiaSpeed = isPremium ? 0.004 : 0.06;
    
    // Ganho solar pela cobertura — tradicional absorve muito mais
    const solarConductionCoefficient = isPremium ? 0.012 : 0.08;
    const envelopeSolarBoost = isPremium
      ? 0
      : params.solarRadiation * (1 - cv.config.shadingFactor) * 0.00015;
    
    // Para estabilidade numérica, sub-dividimos o passo caso dtSim seja maior que 1 segundo
    const subSteps = Math.max(1, Math.min(100, Math.floor(dtSim)));
    const dtSub = dtSim / subSteps;
    
    // Coeficientes construtivos
    const A_roof = cv.config.length * cv.config.width * 1.05; // 5% de margem pela inclinação
    const A_walls = 2 * (cv.config.length + cv.config.width) * cv.config.height; 
    
    // Integração de Euler Sub-stepped
    for (let step = 0; step < subSteps; step++) {
      // Envelope: premium segue T_ext; tradicional acumula calor solar no telhado
      cv.T_envelope += (params.T_ext - cv.T_envelope) * dtSub * thermalInertiaSpeed;
      if (envelopeSolarBoost > 0) {
        cv.T_envelope += envelopeSolarBoost * dtSub;
      }

      // 1. Obter razões de umidade atuais
      const w_ext = getHumidityRatio(params.T_ext, params.RH_ext);
      
      // 2. Calcular Ventilação e Fluxo de Ar usando o novo modelo acoplado
      const ventResult = calculateVentilationResponse({
        volume: cv.volume,
        crossSectionWidth: cv.config.width,
        crossSectionHeight: cv.config.height,
        fanFlowRate: params.fanFlowRate,
        curtainOpening: params.curtainOpening,
        windSpeed: effectiveWindSpeed,
        windAngle: 90, // Direção transversal
        lanternimOpen: lanternimIsOpen,
        lanternimArea: lanternimIsOpen ? cv.config.length * 0.12 : 0,
        deltaTemp: Math.max(0, cv.T_int - params.T_ext),
        buildingHeight: cv.config.height,
        infiltrationACH: baseInfiltration
      }, cv.T_int, params.T_ext, cv.w_int, w_ext);
      
      const m_dot_vent = ventResult.totalFlowRate * RHO_AR; // kg/s
      
      // 3. Calcular Balanço de Umidade e Calor Metabólico usando o novo modelo acoplado
      const moistureResult = calculateMoistureBalance({
        numHorses: params.numHorses,
        activity: params.horseActivity,
        beddingWetness: params.beddingWetness,
        beddingArea: cv.config.length * cv.config.width * 0.7, // Área coberta por cama
        wetFloorArea: cv.config.length * cv.config.width * 0.1, // Área de piso molhado residual
        waterSurfaceArea: params.numHorses * 0.15, // Bebedouros
        waterTemperature: Math.min(22.0, params.T_ext),
        tInt: cv.T_int,
        rhInt: cv.RH_int,
        airSpeed: ventResult.meanAirSpeed,
        ventilationMassFlow: m_dot_vent,
        wInt: cv.w_int,
        wExt: w_ext
      });
      
      // 4. Ganhos Solares na Cobertura
      const Q_sol = params.solarRadiation * A_roof * (1 - cv.config.shadingFactor) * (cv.config.roofUValue * solarConductionCoefficient);
      
      // 5. Condução térmica pela envoltória baseada na temperatura do envelope (com atraso térmico)
      const Q_cond = (cv.config.wallUValue * A_walls + cv.config.roofUValue * A_roof) * (cv.T_envelope - cv.T_int);
      
      // 6. Energia trocada pela ventilação (W)
      const Q_vent = ventResult.sensibleHeatRemoval;
      
      // 7. Equação de Balanço Térmico: dT/dt = (Q_sol + Q_met + Q_cond + Q_vent) / (Massa_ar * cp * 1000)
      const Q_met = moistureResult.animalSensibleHeat;
      const netHeatFlow = Q_sol + Q_met + Q_cond + Q_vent; // Watts
      const dT = netHeatFlow / (cv.airMass * CP_AR * 1000); // °C / s
      
      cv.T_int += dT * dtSub;
      
      // 8. Equação de Balanço de Umidade: dw/dt = netMoistureFlow / Massa_ar
      const netMoistureFlow = moistureResult.netAccumulation;
      const dw = netMoistureFlow / cv.airMass; // kg_vapor / (kg_ar * s)
      
      cv.w_int += dw * dtSub;
      
      // Limites físicos de segurança para umidade
      cv.w_int = Math.max(0.0001, Math.min(0.05, cv.w_int));
      
      // Atualizar a umidade relativa correspondente a esta iteração para consistência do próximo passo
      cv.RH_int = getRelativeHumidity(cv.T_int, cv.w_int);
      
      // Salvar os fluxos no final do substepping para telemetria
      if (step === subSteps - 1) {
        cv.Q_solar = Q_sol;
        cv.Q_metabolic = Q_met;
        cv.Q_conduction = Q_cond;
        cv.Q_ventilation = Q_vent;
        cv.m_vapor_gen = moistureResult.totalGeneration;
        cv.ventilationRate = ventResult.ach;
        cv.airSpeed = ventResult.meanAirSpeed;
        cv.ventFlowMechanical = ventResult.flowComponents.mechanical;
        cv.ventFlowStack = ventResult.flowComponents.stackEffect;
        cv.ventFlowCurtain = ventResult.flowComponents.curtainWind;
        cv.ventFlowInfiltration = ventResult.flowComponents.infiltration;
        cv.ventFlowTotal = ventResult.totalFlowRate;
      }
    }
  }
}
