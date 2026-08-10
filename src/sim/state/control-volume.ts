/**
 * control-volume.ts
 * 
 * Volume de Controle termodinâmico da instalação equina.
 * 
 * Expandido para suportar:
 * - Métricas de atuadores (ventiladores, cortinas)
 * - Separação entre valor real e valor medido com ruído
 * - Velocidade do ar e taxa de renovação
 * - Consumo energético acumulado
 * - Métricas de conforto acumuladas
 * - Campos de conexão IoT (heartbeat, status)
 * 
 * Nota: Esse módulo mantém compatibilidade retroativa — o PhysicsEngine
 * existente continua funcionando sem alterações. Os novos campos são
 * populados pelo App refatorado.
 */

import { getHumidityRatio, RHO_AR } from '../../domain/climate/psychrometrics.ts';
import type { ActuatorState, ConnectionStatus, SensorHealthStatus } from '../../iot/message-schema.ts';

export interface CVConfig {
  length: number;       // metros
  width: number;        // metros
  height: number;       // metros (pé-direito médio)
  roofUValue: number;   // W/m²K (isolamento térmico da cobertura, e.g. 0.5 a 3.0)
  wallUValue: number;   // W/m²K (isolamento térmico das paredes)
  shadingFactor: number; // 0.0 (sem sombra) a 1.0 (sombra total sobre o telhado)
}

export class ControlVolume {
  // ─── Configuração Geométrica e Construtiva ─────────────────────────
  public config: CVConfig;
  
  // Preset estrutural ativo
  public structuralPreset: 'traditional' | 'premium' = 'traditional';
  
  // ─── Estados Dinâmicos (valor REAL do modelo) ──────────────────────
  public T_int: number;       // Temperatura interna real (°C)
  public w_int: number;       // Razão de umidade interna (kg_água / kg_ar_seco)
  public RH_int: number;      // Umidade Relativa interna real (%)
  
  // Temperatura efetiva da envoltória (simula inércia/atraso térmico)
  public T_envelope: number = 25.0;
  
  // ─── Valores Medidos (com ruído de sensor) ─────────────────────────
  public T_measured: number = 25.0;
  public RH_measured: number = 60.0;
  public airSpeed_measured: number = 0.3;
  
  // ─── Valores Filtrados (após processamento EMA) ────────────────────
  public T_filtered: number = 25.0;
  public RH_filtered: number = 60.0;
  public airSpeed_filtered: number = 0.3;
  
  // ─── Volume e massa de ar ──────────────────────────────────────────
  public volume: number;      // m³
  public airMass: number;     // kg
  
  // ─── Métricas do Último Frame (balanço de energia) ─────────────────
  public Q_solar: number = 0;       // Watts — ganho por radiação solar
  public Q_metabolic: number = 0;   // Watts — calor sensível total dos animais
  public Q_conduction: number = 0;  // Watts — condução pela envoltória
  public Q_ventilation: number = 0; // Watts — troca sensível pela ventilação
  public m_vapor_gen: number = 0;   // kg/s — geração de vapor total
  
  // ─── Ventilação e Fluxo de Ar ──────────────────────────────────────
  /** Taxa de renovação de ar total (trocas por hora — ACH) */
  public ventilationRate: number = 0.4;
  
  /** Velocidade média do ar interno (m/s) — estimada */
  public airSpeed: number = 0.3;

  /** Componentes de vazão do último passo físico (m³/s) — para visualização acoplada */
  public ventFlowMechanical: number = 0;
  public ventFlowStack: number = 0;
  public ventFlowCurtain: number = 0;
  public ventFlowInfiltration: number = 0;
  public ventFlowTotal: number = 0;
  
  // ─── Atuadores ─────────────────────────────────────────────────────
  /** Estado lógico do ventilador principal */
  public fanState: ActuatorState = 'off';
  
  /** RPM atual do ventilador (0 = desligado, sobe gradualmente) */
  public fanRPM: number = 0;
  
  /** Vazão atual do ventilador baseada no RPM (m³/h) */
  public fanFlowRate: number = 0;
  
  /** Consumo de energia instantâneo dos atuadores (Watts) */
  public actuatorPower: number = 0;
  
  /** Energia acumulada consumida pelos atuadores (Wh) */
  public energyConsumed: number = 0;
  
  // ─── IoT / Arduino ─────────────────────────────────────────────────
  /** Status de conexão com o Arduino */
  public arduinoStatus: ConnectionStatus = 'disconnected';
  
  /** Timestamp do último heartbeat recebido (ms) */
  public lastHeartbeat: number = 0;
  
  /** Status de saúde do sensor de temperatura */
  public tempSensorHealth: SensorHealthStatus = 'ok';
  
  /** Status de saúde do sensor de umidade */
  public rhSensorHealth: SensorHealthStatus = 'ok';
  
  // ─── Métricas Acumuladas de Conforto ───────────────────────────────
  /** Horas acumuladas fora da faixa de conforto */
  public hoursOutOfComfort: number = 0;
  
  /** Temperatura pico registrada (°C) */
  public peakTemperature: number = 0;
  
  /** Umidade pico registrada (%) */
  public peakHumidity: number = 0;
  
  /** Tempo simulado acumulado (segundos) */
  public simTimeElapsed: number = 0;
  
  constructor(config: CVConfig, initialTemp = 25.0, initialRH = 60.0) {
    this.config = config;
    this.T_int = initialTemp;
    this.T_envelope = initialTemp;
    this.w_int = getHumidityRatio(initialTemp, initialRH);
    this.RH_int = initialRH;
    
    // Inicializar medido e filtrado com os mesmos valores
    this.T_measured = initialTemp;
    this.RH_measured = initialRH;
    this.T_filtered = initialTemp;
    this.RH_filtered = initialRH;
    
    this.volume = config.length * config.width * config.height;
    this.airMass = this.volume * RHO_AR;
    
    this.peakTemperature = initialTemp;
    this.peakHumidity = initialRH;
  }
  
  /**
   * Recalcula o volume e a massa de ar caso as dimensões mudem
   */
  public updateDimensions(): void {
    this.volume = this.config.length * this.config.width * this.config.height;
    this.airMass = this.volume * RHO_AR;
  }

  /**
   * Aplica ruído de sensor ao valor real e atualiza o valor medido.
   * Chamado após cada step do PhysicsEngine.
   * 
   * @param tempStdDev Desvio padrão do ruído de temperatura (°C), default ±0.5°C para DHT11
   * @param rhStdDev Desvio padrão do ruído de umidade (%), default ±2% para DHT11
   */
  public updateMeasuredValues(tempStdDev = 0.5, rhStdDev = 2.0): void {
    this.T_measured = this.applyGaussianNoise(this.T_int, tempStdDev);
    this.RH_measured = Math.min(100, Math.max(0, this.applyGaussianNoise(this.RH_int, rhStdDev)));
    this.airSpeed_measured = Math.max(0, this.applyGaussianNoise(this.airSpeed, 0.05));
  }
  
  /**
   * Aplica filtro EMA (Exponential Moving Average) ao valor medido.
   * 
   * @param alpha Fator de suavização (0–1). Menor = mais suave. Default 0.15.
   */
  public updateFilteredValues(alpha = 0.15): void {
    this.T_filtered = alpha * this.T_measured + (1 - alpha) * this.T_filtered;
    this.RH_filtered = alpha * this.RH_measured + (1 - alpha) * this.RH_filtered;
    this.airSpeed_filtered = alpha * this.airSpeed_measured + (1 - alpha) * this.airSpeed_filtered;
  }
  
  /**
   * Atualiza métricas acumuladas de conforto e picos.
   * 
   * @param dtSimSeconds Tempo simulado transcorrido neste step (segundos)
   * @param isOutOfComfort Se o estado atual está fora da faixa de conforto
   */
  public updateAccumulatedMetrics(dtSimSeconds: number, isOutOfComfort: boolean): void {
    this.simTimeElapsed += dtSimSeconds;
    
    if (isOutOfComfort) {
      this.hoursOutOfComfort += dtSimSeconds / 3600;
    }
    
    if (this.T_int > this.peakTemperature) {
      this.peakTemperature = this.T_int;
    }
    if (this.RH_int > this.peakHumidity) {
      this.peakHumidity = this.RH_int;
    }
  }
  
  /**
   * Acumula consumo energético dos atuadores.
   * 
   * @param powerWatts Potência instantânea (W)
   * @param dtRealSeconds Tempo real transcorrido (s)
   */
  public accumulateEnergy(powerWatts: number, dtRealSeconds: number): void {
    this.actuatorPower = powerWatts;
    this.energyConsumed += (powerWatts * dtRealSeconds) / 3600; // Wh
  }

  /**
   * Reseta o estado do volume de controle para os valores padrão
   */
  public reset(temp = 25.0, rh = 60.0): void {
    this.T_int = temp;
    this.w_int = getHumidityRatio(temp, rh);
    this.RH_int = rh;
    
    // Reset medido e filtrado
    this.T_measured = temp;
    this.RH_measured = rh;
    this.airSpeed_measured = 0.3;
    this.T_filtered = temp;
    this.RH_filtered = rh;
    this.airSpeed_filtered = 0.3;
    
    // Reset métricas de balanço
    this.Q_solar = 0;
    this.Q_metabolic = 0;
    this.Q_conduction = 0;
    this.Q_ventilation = 0;
    this.m_vapor_gen = 0;
    
    // Reset ventilação
    this.ventilationRate = 0.4;
    this.airSpeed = 0.3;
    this.ventFlowMechanical = 0;
    this.ventFlowStack = 0;
    this.ventFlowCurtain = 0;
    this.ventFlowInfiltration = 0;
    this.ventFlowTotal = 0;
    
    // Reset atuadores
    this.fanState = 'off';
    this.fanRPM = 0;
    this.fanFlowRate = 0;
    this.actuatorPower = 0;
    this.energyConsumed = 0;
    
    // Reset métricas acumuladas
    this.hoursOutOfComfort = 0;
    this.peakTemperature = temp;
    this.peakHumidity = rh;
    this.simTimeElapsed = 0;
  }
  
  /**
   * Box-Muller transform para ruído gaussiano
   */
  private applyGaussianNoise(value: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return value + z0 * stdDev;
  }
}
