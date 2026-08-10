/**
 * canonical-message.ts
 *
 * Schema canônico interno para mensagens entre simulador e controlador.
 * Adaptadores convertem de/para este formato nos protocolos de transporte.
 */

export type ControllerMode = 'MANUAL' | 'AUTO' | 'SUPERVISED';

/** Simulador → Controlador */
export interface SensorDataMessage {
  origin: 'simulator';
  timestamp: number;
  sensors: {
    t_int: number;
    rh_int: number;
    air_speed: number;
    t_ext: number;
    rh_ext: number;
    solar_rad: number;
    t_roof: number;
    t_floor: number;
    heat_load_animal: number;
  };
  setpoints: {
    temp_max: number;
    temp_min: number;
    rh_max_limit: number;
  };
  mode: ControllerMode;
}

/** Controlador → Simulador */
export interface ActuatorCommandMessage {
  origin: 'arduino';
  timestamp: number;
  actuators: {
    fan_1: boolean;
    fan_2: boolean;
    mist_pump: boolean;
    exhaust_status: 'active' | 'inactive' | 'fault';
  };
  system_state: {
    mode: ControllerMode;
    thermal_alert: boolean;
    sensor_fault: boolean;
  };
}

export interface ActuatorState {
  fan_1: boolean;
  fan_2: boolean;
  mist_pump: boolean;
}
