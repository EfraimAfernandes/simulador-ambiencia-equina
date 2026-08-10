/**
 * global-state.ts
 * 
 * Store reativo central do Gêmeo Digital Equino.
 * 
 * Princípio: separação explícita entre valor físico real do sistema,
 * valor medido com ruído do sensor, valor filtrado e valor exibido na UI.
 * 
 * Todos os quatro núcleos (físico, zootécnico, automação, visual) leem
 * e escrevem neste store. A renderização é subordinada ao estado físico.
 */

import {
  ControlMode,
  ConnectionStatus,
  FanState,
  SensorHealthMap,
  Setpoints,
  HysteresisBands,
  CommandLogEntry,
  TelemetryEvent,
  AlarmMessage,
  ActuatorCommand,
  LayeredValues,
  createDefaultFanState,
  createDefaultSetpoints,
  createDefaultHysteresisBands,
  createDefaultSensorHealth,
} from '../../iot/message-schema.ts';

// ─── Tipos de Zona ───────────────────────────────────────────────────

/** Estado de uma zona individual no modelo multizona */
export interface ZoneState {
  id: string;
  name: string;                    // Ex: "Baia 01", "Corredor", "Zona Superior"
  volume: number;                  // m³
  
  // Valores reais (saída do modelo físico)
  trueTemperature: number;         // °C
  trueHumidity: number;            // %
  trueAirSpeed: number;            // m/s
  
  // Valores medidos (com ruído)
  measuredTemperature: number;     // °C
  measuredHumidity: number;        // %
  measuredAirSpeed: number;        // m/s
  
  // Ocupação
  horseCount: number;
  metabolicHeat: number;           // W total nesta zona
  vaporGeneration: number;         // kg/s total nesta zona
  
  // Métricas acumuladas
  hoursOutOfComfort: number;       // Horas fora da faixa de conforto
  peakTemperature: number;         // °C máxima registrada
  peakHumidity: number;            // % máxima registrada
}

// ─── Modo de Visualização ────────────────────────────────────────────

/** Modos de visualização do renderizador */
export type VisualizationMode = 'immersive' | 'thermal' | 'automation';

// ─── Estado Completo do Gêmeo Digital ────────────────────────────────

export interface DigitalTwinState {
  // ─── Relógio da Simulação ────────────────
  simTime: number;                 // Tempo simulado acumulado (segundos)
  simTimeScale: number;            // Fator de aceleração temporal
  isPaused: boolean;
  
  // ─── Física — Valores por Camada ─────────
  /** Valor real: saída do modelo físico, sem ruído */
  trueValues: LayeredValues;
  /** Valor medido: com ruído e atraso de sensor */
  measuredValues: LayeredValues;
  /** Valor filtrado: após média móvel / EMA */
  filteredValues: LayeredValues;
  /** Valor exibido: formatado para a UI */
  displayValues: LayeredValues;
  
  // ─── Zonas (futuro multizona) ────────────
  zoneStates: ZoneState[];
  
  // ─── Atuadores ───────────────────────────
  fanStates: FanState[];
  ventilationRate: number;         // ACH total
  airSpeed: number;                // m/s médio
  actuatorCommands: ActuatorCommand[];  // Fila de comandos
  energyConsumptionActuators: number;   // Wh acumulado
  
  // ─── Controle / Automação ────────────────
  controlMode: ControlMode;
  setpoints: Setpoints;
  hysteresisBands: HysteresisBands;
  
  // ─── IoT / Arduino ──────────────────────
  arduinoConnectionStatus: ConnectionStatus;
  lastArduinoHeartbeat: number;    // timestamp ms
  sensorHealth: SensorHealthMap;
  
  // ─── Eventos e Logs ──────────────────────
  telemetryEvents: TelemetryEvent[];
  alarms: AlarmMessage[];
  commandLog: CommandLogEntry[];
  
  // ─── Visualização ────────────────────────
  visualizationMode: VisualizationMode;
  
  // ─── Métricas de Qualidade ───────────────
  comfortIndex: number;            // Índice equino atual
  comfortLabel: string;
  totalHoursOutOfComfort: number;
  totalEnergyConsumed: number;     // Wh total
}

// ─── Valores Padrão ──────────────────────────────────────────────────

/** Cria a zona padrão única (modelo 0D) */
function createDefaultZone(): ZoneState {
  return {
    id: 'zone-main',
    name: 'Galpão Principal',
    volume: 12 * 8 * 4.5,   // 432 m³
    trueTemperature: 25.0,
    trueHumidity: 60.0,
    trueAirSpeed: 0.3,
    measuredTemperature: 25.0,
    measuredHumidity: 60.0,
    measuredAirSpeed: 0.3,
    horseCount: 4,
    metabolicHeat: 2400,     // 4 × 600 W
    vaporGeneration: 0.00064, // 4 × 0.00016 kg/s
    hoursOutOfComfort: 0,
    peakTemperature: 25.0,
    peakHumidity: 60.0,
  };
}

/** Cria o estado inicial completo do gêmeo digital */
export function createInitialState(): DigitalTwinState {
  const defaultLayered: LayeredValues = {
    temperature: 25.0,
    humidity: 60.0,
    airSpeed: 0.3,
  };
  
  return {
    // Relógio
    simTime: 0,
    simTimeScale: 60,
    isPaused: false,
    
    // Valores por camada
    trueValues: { ...defaultLayered },
    measuredValues: { ...defaultLayered },
    filteredValues: { ...defaultLayered },
    displayValues: { ...defaultLayered },
    
    // Zonas
    zoneStates: [createDefaultZone()],
    
    // Atuadores
    fanStates: [
      createDefaultFanState('fan-exhaust-01'),
      createDefaultFanState('fan-exhaust-02'),
    ],
    ventilationRate: 0.4,     // ACH natural mínimo
    airSpeed: 0.3,
    actuatorCommands: [],
    energyConsumptionActuators: 0,
    
    // Controle
    controlMode: 'manual',
    setpoints: createDefaultSetpoints(),
    hysteresisBands: createDefaultHysteresisBands(),
    
    // IoT
    arduinoConnectionStatus: 'disconnected',
    lastArduinoHeartbeat: 0,
    sensorHealth: {
      'dht11-temp': createDefaultSensorHealth('dht11-temp'),
      'dht11-rh': createDefaultSensorHealth('dht11-rh'),
    },
    
    // Eventos
    telemetryEvents: [],
    alarms: [],
    commandLog: [],
    
    // Visualização
    visualizationMode: 'immersive',
    
    // Métricas
    comfortIndex: 0,
    comfortLabel: 'Conforto Térmico',
    totalHoursOutOfComfort: 0,
    totalEnergyConsumed: 0,
  };
}

// ─── Store Reativo ───────────────────────────────────────────────────

/** Callback de subscriber */
export type StateSubscriber = (state: DigitalTwinState, changedKeys: Set<string>) => void;

/**
 * Store reativo central.
 * 
 * Padrão observer: módulos subscrevem para receber notificações
 * quando o estado muda. Permite updates parciais e batch.
 */
export class DigitalTwinStore {
  private state: DigitalTwinState;
  private subscribers: Map<string, StateSubscriber> = new Map();
  private batchDepth = 0;
  private pendingChangedKeys = new Set<string>();
  
  constructor(initialState?: Partial<DigitalTwinState>) {
    this.state = {
      ...createInitialState(),
      ...initialState,
    };
  }
  
  /** Lê o estado completo (snapshot imutável — não modificar diretamente) */
  getState(): Readonly<DigitalTwinState> {
    return this.state;
  }
  
  /**
   * Atualiza parcialmente o estado.
   * Notifica subscribers após a atualização (ou após batch).
   */
  update(partial: Partial<DigitalTwinState>): void {
    const changedKeys = new Set<string>();
    
    for (const key of Object.keys(partial) as Array<keyof DigitalTwinState>) {
      if (partial[key] !== undefined) {
        (this.state as any)[key] = partial[key];
        changedKeys.add(key);
      }
    }
    
    if (this.batchDepth > 0) {
      // Dentro de um batch — acumula e notifica no final
      for (const k of changedKeys) {
        this.pendingChangedKeys.add(k);
      }
    } else {
      this.notifySubscribers(changedKeys);
    }
  }
  
  /**
   * Abre um batch de atualizações.
   * Subscribers só são notificados quando endBatch() é chamado.
   * Útil para o sim loop que atualiza múltiplos campos por tick.
   */
  beginBatch(): void {
    this.batchDepth++;
  }
  
  /** Fecha o batch e notifica subscribers com todas as chaves acumuladas */
  endBatch(): void {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    if (this.batchDepth === 0 && this.pendingChangedKeys.size > 0) {
      const keys = new Set(this.pendingChangedKeys);
      this.pendingChangedKeys.clear();
      this.notifySubscribers(keys);
    }
  }
  
  /**
   * Registra um subscriber que será notificado a cada update.
   * Retorna o subscriberId para uso em unsubscribe().
   */
  subscribe(id: string, callback: StateSubscriber): void {
    this.subscribers.set(id, callback);
  }
  
  /** Remove um subscriber */
  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }
  
  /** Notifica todos os subscribers */
  private notifySubscribers(changedKeys: Set<string>): void {
    for (const callback of this.subscribers.values()) {
      callback(this.state, changedKeys);
    }
  }
  
  // ─── Helpers de Conveniência ──────────────────────────────────────
  
  /** Adiciona uma entrada ao log de comandos (máximo 500 entradas) */
  logCommand(entry: CommandLogEntry): void {
    this.state.commandLog.push(entry);
    if (this.state.commandLog.length > 500) {
      this.state.commandLog.shift();
    }
    this.notifySubscribers(new Set(['commandLog']));
  }
  
  /** Adiciona um alarme ativo */
  addAlarm(alarm: AlarmMessage): void {
    this.state.alarms.push(alarm);
    if (this.state.alarms.length > 100) {
      this.state.alarms.shift();
    }
    this.notifySubscribers(new Set(['alarms']));
  }
  
  /** Adiciona um evento de telemetria (buffer circular de 1000) */
  addTelemetryEvent(event: TelemetryEvent): void {
    this.state.telemetryEvents.push(event);
    if (this.state.telemetryEvents.length > 1000) {
      this.state.telemetryEvents.shift();
    }
    // Telemetria não notifica subscribers a cada evento (performance)
  }
  
  /** Adiciona consumo energético em Wh */
  addEnergyConsumption(wh: number): void {
    this.state.energyConsumptionActuators += wh;
    this.state.totalEnergyConsumed += wh;
  }
  
  /**
   * Aplica ruído de sensor gaussiano ao valor real.
   * stdDev é o desvio padrão do ruído em unidades da variável.
   */
  static applyNoise(trueValue: number, stdDev: number): number {
    // Box-Muller transform para ruído gaussiano
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return trueValue + z0 * stdDev;
  }
  
  /**
   * Aplica filtro de média móvel exponencial (EMA).
   * alpha ∈ (0, 1] — quanto maior, mais peso ao valor novo.
   */
  static applyEMA(previousFiltered: number, newMeasured: number, alpha: number): number {
    return alpha * newMeasured + (1 - alpha) * previousFiltered;
  }
  
  /** Reseta o estado para valores iniciais */
  reset(): void {
    const fresh = createInitialState();
    this.state = fresh;
    this.notifySubscribers(new Set(Object.keys(fresh)));
  }
}
