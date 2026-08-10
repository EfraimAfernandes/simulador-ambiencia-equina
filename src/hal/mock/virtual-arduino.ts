/**
 * virtual-arduino.ts
 *
 * Mock do controlador Arduino — usa JsonLineAdapter + control-logic.ts.
 * Lógica idêntica ao firmware C++ para testes sem hardware.
 */

import { evaluateControl } from '../../automation/control-logic.ts';
import type {
  ArduinoInterface,
  CommandCallback,
  LogCallback,
} from '../arduino-interface.ts';
import type {
  ActuatorCommandMessage,
  ActuatorState,
  SensorDataMessage,
} from '../canonical-message.ts';
import { JsonLineAdapter } from '../adapters/json-line-adapter.ts';

export class VirtualArduino implements ArduinoInterface {
  private connected = false;
  private commandCallbacks = new Set<CommandCallback>();
  private logCallbacks = new Set<LogCallback>();
  private previousActuators: ActuatorState = {
    fan_1: false,
    fan_2: false,
    mist_pump: false,
  };
  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.log('VirtualArduino conectado (modo mock).');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.previousActuators = { fan_1: false, fan_2: false, mist_pump: false };
    this.log('VirtualArduino desconectado.');
  }

  async sendSensorData(data: SensorDataMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('VirtualArduino não está conectado.');
    }

    const wireLine = JsonLineAdapter.encodeSensorData(data);
    this.log(`RX (mock): ${wireLine}`);

    const result = evaluateControl(
      { t_int: data.sensors.t_int, rh_int: data.sensors.rh_int },
      data.setpoints,
      this.previousActuators
    );

    this.previousActuators = {
      fan_1: result.fan_1,
      fan_2: result.fan_2,
      mist_pump: result.mist_pump,
    };

    const anyFanOn = result.fan_1 || result.fan_2;
    const command: ActuatorCommandMessage = {
      origin: 'arduino',
      timestamp: Date.now(),
      actuators: {
        fan_1: result.fan_1,
        fan_2: result.fan_2,
        mist_pump: result.mist_pump,
        exhaust_status: anyFanOn ? 'active' : 'inactive',
      },
      system_state: {
        mode: data.mode,
        thermal_alert: result.thermal_alert,
        sensor_fault: false,
      },
    };

    const txLine = JsonLineAdapter.encodeActuatorCommand(command);
    this.log(`TX (mock): ${txLine}`);
    this.emitCommand(command);
  }

  onCommandReceived(callback: CommandCallback): void {
    this.commandCallbacks.add(callback);
  }

  offCommandReceived(callback: CommandCallback): void {
    this.commandCallbacks.delete(callback);
  }

  onLog(callback: LogCallback): void {
    this.logCallbacks.add(callback);
  }

  offLog(callback: LogCallback): void {
    this.logCallbacks.delete(callback);
  }

  private emitCommand(command: ActuatorCommandMessage): void {
    this.commandCallbacks.forEach((cb) => cb(command));
  }

  private log(message: string): void {
    this.logCallbacks.forEach((cb) => cb(message));
  }
}
