/**
 * sensor-data-builder.ts
 *
 * Monta SensorDataMessage a partir do estado da simulação.
 */

import type { ControllerMode, SensorDataMessage } from './canonical-message.ts';
import type { ControlVolume } from '../sim/state/control-volume.ts';
import type { Setpoints } from '../iot/message-schema.ts';

export interface SensorDataContext {
  cv: ControlVolume;
  tExt: number;
  rhExt: number;
  solarRad: number;
  setpoints: Setpoints;
  mode: ControllerMode;
}

export function buildSensorDataMessage(ctx: SensorDataContext): SensorDataMessage {
  const { cv, tExt, rhExt, solarRad, setpoints, mode } = ctx;

  return {
    origin: 'simulator',
    timestamp: Date.now(),
    sensors: {
      t_int: cv.T_filtered,
      rh_int: cv.RH_filtered,
      air_speed: cv.airSpeed_filtered,
      t_ext: tExt,
      rh_ext: rhExt,
      solar_rad: solarRad,
      t_roof: cv.T_envelope,
      t_floor: cv.T_int - 1.5,
      heat_load_animal: cv.Q_metabolic,
    },
    setpoints: {
      temp_max: setpoints.temperatureHigh,
      temp_min: setpoints.temperatureLow,
      rh_max_limit: setpoints.humidityHigh,
    },
    mode,
  };
}
