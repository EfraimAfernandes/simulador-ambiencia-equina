/**
 * iot-factory.ts
 *
 * Fábrica para instanciar o controlador IoT adequado ao modo selecionado.
 */

import type { ArduinoInterface } from './arduino-interface.ts';
import { VirtualArduino } from './mock/virtual-arduino.ts';
import { WebSerialBridge } from '../iot/web-serial-bridge.ts';

export type IoTControllerMode = 'none' | 'mock' | 'hardware';

export function createArduinoInterface(mode: IoTControllerMode): ArduinoInterface | null {
  switch (mode) {
    case 'mock':
      return new VirtualArduino();
    case 'hardware':
      return new WebSerialBridge();
    default:
      return null;
  }
}
