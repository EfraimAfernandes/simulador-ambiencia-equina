/**
 * compact-serial-adapter.ts
 *
 * Converte entre schema canônico e protocolo compacto serial (Arduino real).
 *
 * TX: ENV T:28.4 H:65.2 AIR:13 RAD:420 FAN1:0 FAN2:1
 * RX: ACK FAN1:1 FAN2:1 MIST:0 ALERT:1 FAULT:0
 */

import type {
  ActuatorCommandMessage,
  ControllerMode,
  SensorDataMessage,
} from '../canonical-message.ts';

export class CompactSerialAdapter {
  /** Codifica SensorDataMessage para linha compacta ENV */
  static encodeSensorData(msg: SensorDataMessage, fan1 = false, fan2 = false): string {
    const airScaled = Math.round(msg.sensors.air_speed * 10);
    const fan1Val = fan1 ? 1 : 0;
    const fan2Val = fan2 ? 1 : 0;
    return (
      `ENV T:${msg.sensors.t_int.toFixed(1)} ` +
      `H:${msg.sensors.rh_int.toFixed(1)} ` +
      `AIR:${airScaled} ` +
      `RAD:${Math.round(msg.sensors.solar_rad)} ` +
      `FAN1:${fan1Val} FAN2:${fan2Val}`
    );
  }

  /** Decodifica linha ACK em ActuatorCommandMessage */
  static decodeActuatorCommand(
    line: string,
    mode: ControllerMode = 'AUTO'
  ): ActuatorCommandMessage | null {
    if (!line.startsWith('ACK')) return null;

    const fan1 = CompactSerialAdapter.parseField(line, 'FAN1');
    const fan2 = CompactSerialAdapter.parseField(line, 'FAN2');
    const mist = CompactSerialAdapter.parseField(line, 'MIST');
    const alert = CompactSerialAdapter.parseField(line, 'ALERT');
    const fault = CompactSerialAdapter.parseField(line, 'FAULT');

    if (fan1 === null || fan2 === null) return null;

    const anyFanOn = fan1 === 1 || fan2 === 1;

    return {
      origin: 'arduino',
      timestamp: Date.now(),
      actuators: {
        fan_1: fan1 === 1,
        fan_2: fan2 === 1,
        mist_pump: mist === 1,
        exhaust_status: fault === 1 ? 'fault' : anyFanOn ? 'active' : 'inactive',
      },
      system_state: {
        mode,
        thermal_alert: alert === 1,
        sensor_fault: fault === 1,
      },
    };
  }

  /** Decodifica linha ENV recebida (útil para debug / testes) */
  static decodeSensorData(line: string): Partial<SensorDataMessage['sensors']> | null {
    if (!line.startsWith('ENV')) return null;

    const t = CompactSerialAdapter.parseFloatField(line, 'T');
    const h = CompactSerialAdapter.parseFloatField(line, 'H');
    const air = CompactSerialAdapter.parseField(line, 'AIR');
    const rad = CompactSerialAdapter.parseField(line, 'RAD');

    if (t === null || h === null) return null;

    return {
      t_int: t,
      rh_int: h,
      air_speed: air !== null ? air / 10 : 0,
      solar_rad: rad ?? 0,
    };
  }

  private static parseField(line: string, key: string): number | null {
    const match = line.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1], 10) : null;
  }

  private static parseFloatField(line: string, key: string): number | null {
    const match = line.match(new RegExp(`${key}:([\\d.]+)`));
    return match ? parseFloat(match[1]) : null;
  }
}
