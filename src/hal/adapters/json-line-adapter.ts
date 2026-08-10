/**
 * json-line-adapter.ts
 *
 * Converte entre schema canônico e JSON Line (mock/desktop).
 */

import type { ActuatorCommandMessage, SensorDataMessage } from '../canonical-message.ts';

export class JsonLineAdapter {
  static encodeSensorData(msg: SensorDataMessage): string {
    return JSON.stringify(msg);
  }

  static decodeSensorData(line: string): SensorDataMessage | null {
    try {
      const parsed = JSON.parse(line);
      if (parsed.origin === 'simulator' && parsed.sensors) {
        return parsed as SensorDataMessage;
      }
    } catch {
      /* linha inválida */
    }
    return null;
  }

  static encodeActuatorCommand(msg: ActuatorCommandMessage): string {
    return JSON.stringify(msg);
  }

  static decodeActuatorCommand(line: string): ActuatorCommandMessage | null {
    try {
      const parsed = JSON.parse(line);
      if (parsed.origin === 'arduino' && parsed.actuators) {
        return parsed as ActuatorCommandMessage;
      }
    } catch {
      /* linha inválida */
    }
    return null;
  }
}
