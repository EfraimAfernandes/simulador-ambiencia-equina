/**
 * iot-manager.ts
 *
 * Orquestra o controlador IoT (mock ou hardware), envio de sensores
 * e recepção de comandos de atuadores.
 */

import type { ArduinoInterface, CommandCallback } from './arduino-interface.ts';
import type { ControllerMode } from './canonical-message.ts';
import { createArduinoInterface, type IoTControllerMode } from './iot-factory.ts';
import { buildSensorDataMessage } from './sensor-data-builder.ts';
import type { ControlVolume } from '../sim/state/control-volume.ts';
import type { Setpoints, ProtocolMessage } from '../iot/message-schema.ts';
import { WebSerialBridge } from '../iot/web-serial-bridge.ts';

export type LegacyMessageCallback = (message: ProtocolMessage) => void;

const SENSOR_SEND_INTERVAL_MS = 2000;

export class IoTManager {
  private controller: ArduinoInterface | null = null;
  private mode: IoTControllerMode = 'none';
  private lastSendTime = 0;
  private commandCallbacks = new Set<CommandCallback>();
  private legacyCallbacks = new Set<LegacyMessageCallback>();
  private logCallbacks = new Set<(msg: string) => void>();

  readonly actuatorState = {
    fan1: false,
    fan2: false,
    mistPump: false,
    thermalAlert: false,
    sensorFault: false,
  };

  get isConnected(): boolean {
    return this.controller?.isConnected ?? false;
  }

  get currentMode(): IoTControllerMode {
    return this.mode;
  }

  setMode(mode: IoTControllerMode): void {
    if (this.mode === mode) return;
    if (this.isConnected) {
      void this.disconnect();
    }
    this.mode = mode;
    this.controller = createArduinoInterface(mode);
    this.wireController();
  }

  async connect(): Promise<void> {
    if (!this.controller) {
      this.controller = createArduinoInterface(this.mode);
      this.wireController();
    }
    if (!this.controller) {
      throw new Error('Selecione um modo de controlador (Mock ou Hardware).');
    }
    await this.controller.connect();
  }

  async disconnect(): Promise<void> {
    if (this.controller) {
      await this.controller.disconnect();
    }
    this.resetActuatorState();
  }

  onCommandReceived(callback: CommandCallback): void {
    this.commandCallbacks.add(callback);
  }

  onLegacyMessage(callback: LegacyMessageCallback): void {
    this.legacyCallbacks.add(callback);
    if (this.controller instanceof WebSerialBridge) {
      const bridge = this.controller;
      bridge.onLegacyMessage(callback);
    }
  }

  onLog(callback: (msg: string) => void): void {
    this.logCallbacks.add(callback);
    this.controller?.onLog(callback);
  }

  tick(
    cv: ControlVolume,
    tExt: number,
    rhExt: number,
    solarRad: number,
    setpoints: Setpoints,
    controllerMode: ControllerMode
  ): void {
    if (!this.isConnected || !this.controller) return;

    const now = Date.now();
    if (now - this.lastSendTime < SENSOR_SEND_INTERVAL_MS) return;

    this.lastSendTime = now;
    const msg = buildSensorDataMessage({
      cv,
      tExt,
      rhExt,
      solarRad,
      setpoints,
      mode: controllerMode,
    });

    void this.controller.sendSensorData(msg).catch(() => {
      /* erro já logado pelo bridge */
    });
  }

  private wireController(): void {
    if (!this.controller) return;

    this.controller.onCommandReceived((cmd) => {
      this.actuatorState.fan1 = cmd.actuators.fan_1;
      this.actuatorState.fan2 = cmd.actuators.fan_2;
      this.actuatorState.mistPump = cmd.actuators.mist_pump;
      this.actuatorState.thermalAlert = cmd.system_state.thermal_alert;
      this.actuatorState.sensorFault = cmd.system_state.sensor_fault;
      this.commandCallbacks.forEach((cb) => cb(cmd));
    });

    this.logCallbacks.forEach((cb) => this.controller!.onLog(cb));

    if (this.controller instanceof WebSerialBridge) {
      const bridge = this.controller;
      this.legacyCallbacks.forEach((cb) => bridge.onLegacyMessage(cb));
    }
  }

  private resetActuatorState(): void {
    this.actuatorState.fan1 = false;
    this.actuatorState.fan2 = false;
    this.actuatorState.mistPump = false;
    this.actuatorState.thermalAlert = false;
    this.actuatorState.sensorFault = false;
  }
}
