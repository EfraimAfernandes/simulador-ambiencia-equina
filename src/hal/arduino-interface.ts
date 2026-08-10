/**
 * arduino-interface.ts
 *
 * Contrato do dispositivo controlador (mock ou hardware real).
 */

import type { ActuatorCommandMessage, SensorDataMessage } from './canonical-message.ts';

export type CommandCallback = (command: ActuatorCommandMessage) => void;
export type LogCallback = (message: string) => void;

export interface ArduinoInterface {
  readonly isConnected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendSensorData(data: SensorDataMessage): Promise<void>;
  onCommandReceived(callback: CommandCallback): void;
  offCommandReceived(callback: CommandCallback): void;
  onLog(callback: LogCallback): void;
  offLog(callback: LogCallback): void;
}
