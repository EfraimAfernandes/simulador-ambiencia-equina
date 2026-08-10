/**
 * message-schema.ts
 * 
 * Schema completo das mensagens do protocolo de comunicação bidirecional
 * entre o simulador, o motor de automação e o Arduino (real ou mock).
 * 
 * Protocolo:
 *   env_update      → Simulador envia estado ambiental ao Arduino
 *   fan_command      → Arduino/Automação comanda um ventilador
 *   fan_state        → Arduino retorna estado real do ventilador
 *   heartbeat        → Arduino envia sinal periódico de vida
 *   alarm            → Sistema emite alarme operacional
 *   sensor_fault     → Arduino reporta falha de sensor
 *   connection_lost  → Sistema detecta perda de conexão
 */

// ─── Enums e Tipos Base ──────────────────────────────────────────────

/** Modos de controle do sistema de automação */
export type ControlMode = 'manual' | 'auto' | 'supervised' | 'arduino';

/** Estados possíveis de um atuador com dinâmica temporal */
export type ActuatorState = 'off' | 'starting' | 'running' | 'stopping' | 'fault';

/** Severidade de alarmes operacionais */
export type AlarmSeverity = 'info' | 'warning' | 'critical';

/** Status de saúde de um sensor */
export type SensorHealthStatus = 'ok' | 'warning' | 'fault' | 'offline';

/** Status de conexão com Arduino */
export type ConnectionStatus = 'connected' | 'disconnected' | 'timeout';

/** Tipos de falha de sensor */
export type SensorFaultType = 'nan_reading' | 'out_of_range' | 'stale' | 'disconnected';

/** Tipos de alarme do sistema */
export type AlarmType =
  | 'high_temperature'
  | 'high_humidity'
  | 'sensor_fault'
  | 'actuator_fault'
  | 'connection_lost'
  | 'comfort_danger'
  | 'energy_threshold';

// ─── Mensagens do Protocolo ──────────────────────────────────────────

/** 
 * Simulador → Arduino
 * Envia o estado ambiental atual calculado pelo modelo físico.
 */
export interface EnvUpdateMessage {
  type: 'env_update';
  timestamp: number;
  payload: {
    tempInternal: number;     // °C
    rhInternal: number;       // %
    airSpeed: number;         // m/s
    comfortIndex: number;     // índice equino
    tempExternal: number;     // °C
    rhExternal: number;       // %
    ventilationRate: number;  // ACH
  };
}

/**
 * Arduino/Automação → Simulador
 * Comando para acionar ou desligar um ventilador.
 */
export interface FanCommandMessage {
  type: 'fan_command';
  timestamp: number;
  payload: {
    fanId: string;
    action: 'on' | 'off';
    targetSpeed?: number;     // RPM desejado (opcional, para controle proporcional)
    source: ControlMode;      // Quem originou o comando
  };
}

/**
 * Arduino → Simulador
 * Retorna o estado real medido do ventilador.
 */
export interface FanStateMessage {
  type: 'fan_state';
  timestamp: number;
  payload: {
    fanId: string;
    isOn: boolean;
    rpm: number;
    currentAmps: number;      // Corrente medida (A)
    state: ActuatorState;
  };
}

/**
 * Arduino → Simulador
 * Sinal periódico de que o Arduino está ativo e operacional.
 */
export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
  payload: {
    uptimeMs: number;         // Tempo desde boot do Arduino (ms)
    sensorOk: boolean;        // Sensor DHT respondendo normalmente
    freeMemory?: number;      // Memória livre (bytes), se disponível
  };
}

/**
 * Sistema → Log
 * Alarme operacional emitido por qualquer subsistema.
 */
export interface AlarmMessage {
  type: 'alarm';
  timestamp: number;
  payload: {
    alarmType: AlarmType;
    severity: AlarmSeverity;
    message: string;
    zoneId?: string;          // Zona afetada (quando multizona)
    value?: number;           // Valor que disparou o alarme
    threshold?: number;       // Limiar que foi excedido
    acknowledged: boolean;    // Se o operador já reconheceu
  };
}

/**
 * Arduino → Simulador
 * Reporta falha em um sensor específico.
 */
export interface SensorFaultMessage {
  type: 'sensor_fault';
  timestamp: number;
  payload: {
    sensorId: string;
    faultType: SensorFaultType;
    lastGoodValue: number;
    lastGoodTimestamp: number;
  };
}

/**
 * Sistema interno
 * Detecta perda de conexão com Arduino por timeout de heartbeat.
 */
export interface ConnectionLostMessage {
  type: 'connection_lost';
  timestamp: number;
  payload: {
    lastHeartbeat: number;    // Timestamp do último heartbeat recebido
    timeoutMs: number;        // Timeout configurado (ms)
  };
}

/** Union type de todas as mensagens do protocolo */
export type ProtocolMessage =
  | EnvUpdateMessage
  | FanCommandMessage
  | FanStateMessage
  | HeartbeatMessage
  | AlarmMessage
  | SensorFaultMessage
  | ConnectionLostMessage;

// ─── Tipos de Estado do Gêmeo Digital ────────────────────────────────

/** Estado de um ventilador individual */
export interface FanState {
  id: string;
  state: ActuatorState;
  rpm: number;                // RPM atual
  targetRpm: number;          // RPM alvo (para curva de resposta)
  nominalFlowRate: number;    // Vazão nominal em m³/h
  currentFlowRate: number;    // Vazão atual (proporcional ao RPM)
  powerConsumption: number;   // Consumo atual em Watts
  nominalPower: number;       // Consumo nominal em Watts
  rampUpTime: number;         // Tempo de partida em segundos
  rampDownTime: number;       // Tempo de parada em segundos
  maxRpm: number;             // RPM máximo
  hoursOfOperation: number;   // Horas acumuladas de operação
  lastCommandTimestamp: number;
}

/** Saúde individual de um sensor */
export interface SensorHealth {
  sensorId: string;
  status: SensorHealthStatus;
  lastValue: number;
  lastUpdateTimestamp: number;
  readingsCount: number;
  faultCount: number;
  deviation: number;          // Desvio em relação à média recente
}

/** Mapa de saúde de sensores indexado por ID */
export type SensorHealthMap = Record<string, SensorHealth>;

/** Setpoints de controle */
export interface Setpoints {
  temperatureHigh: number;    // °C — acionar resfriamento
  temperatureLow: number;     // °C — desligar resfriamento
  humidityHigh: number;       // % — acionar ventilação extra
  humidityLow: number;        // % — reduzir ventilação
  comfortIndexDanger: number; // Índice equino — alarme de estresse
}

/** Bandas de histerese */
export interface HysteresisBands {
  temperature: number;        // °C (largura total da banda)
  humidity: number;           // % (largura total da banda)
}

/** Registro de comando no log */
export interface CommandLogEntry {
  timestamp: number;
  source: ControlMode;
  target: string;             // ID do atuador ou subsistema
  action: string;             // Descrição do comando
  previousState: string;      // Estado antes do comando
  newState: string;           // Estado após o comando
}

/** Evento de telemetria genérico */
export interface TelemetryEvent {
  timestamp: number;
  eventType: string;
  data: Record<string, number | string | boolean>;
}

/** Valores separados por nível de processamento */
export interface LayeredValues {
  temperature: number;
  humidity: number;
  airSpeed: number;
}

/** Comando de atuador na fila */
export interface ActuatorCommand {
  timestamp: number;
  actuatorId: string;
  command: 'on' | 'off' | 'set_speed';
  value?: number;
  source: ControlMode;
  status: 'pending' | 'executed' | 'failed';
}

// ─── Factory Helpers ─────────────────────────────────────────────────

/** Cria um FanState com valores padrão */
export function createDefaultFanState(id: string): FanState {
  return {
    id,
    state: 'off',
    rpm: 0,
    targetRpm: 0,
    nominalFlowRate: 6000,    // m³/h
    currentFlowRate: 0,
    powerConsumption: 0,
    nominalPower: 750,        // W
    rampUpTime: 8,            // segundos
    rampDownTime: 5,          // segundos
    maxRpm: 1200,
    hoursOfOperation: 0,
    lastCommandTimestamp: 0,
  };
}

/** Cria um SensorHealth com valores padrão */
export function createDefaultSensorHealth(sensorId: string): SensorHealth {
  return {
    sensorId,
    status: 'ok',
    lastValue: 0,
    lastUpdateTimestamp: Date.now(),
    readingsCount: 0,
    faultCount: 0,
    deviation: 0,
  };
}

/** Cria setpoints padrão para controle de ambiência equina */
export function createDefaultSetpoints(): Setpoints {
  return {
    temperatureHigh: 28.0,    // °C
    temperatureLow: 25.0,     // °C
    humidityHigh: 80.0,       // %
    humidityLow: 60.0,        // %
    comfortIndexDanger: 150,  // Índice equino (T°F + RH%)
  };
}

/** Cria bandas de histerese padrão */
export function createDefaultHysteresisBands(): HysteresisBands {
  return {
    temperature: 3.0,         // °C
    humidity: 10.0,           // %
  };
}
