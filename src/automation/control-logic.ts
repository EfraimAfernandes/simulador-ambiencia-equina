/**
 * control-logic.ts
 *
 * Lógica pura de controle com histerese — espelhada no firmware C++.
 * Testes unitários aqui validam o comportamento do Arduino.
 */

export interface ControlSensorReadings {
  t_int: number;
  rh_int: number;
}

export interface ControlSetpoints {
  temp_max: number;
  temp_min: number;
  rh_max_limit: number;
}

export interface ControlActuatorState {
  fan_1: boolean;
  fan_2: boolean;
  mist_pump: boolean;
}

export interface ControlActuatorCommands extends ControlActuatorState {
  thermal_alert: boolean;
}

/**
 * Avalia histerese de temperatura e intertravamento de nebulização.
 * Semântica idêntica ao firmware ProjetoAmbiencia.ino.
 */
export function evaluateControl(
  sensors: ControlSensorReadings,
  sp: ControlSetpoints,
  previous: ControlActuatorState
): ControlActuatorCommands {
  const cmd = { ...previous };

  if (sensors.t_int >= sp.temp_max) {
    cmd.fan_1 = true;
    cmd.fan_2 = true;
  } else if (sensors.t_int <= sp.temp_min) {
    cmd.fan_1 = false;
    cmd.fan_2 = false;
  }

  cmd.mist_pump =
    sensors.t_int >= sp.temp_max + 2.0 && sensors.rh_int < sp.rh_max_limit;

  const thermal_alert = sensors.t_int >= sp.temp_max;

  return { ...cmd, thermal_alert };
}
