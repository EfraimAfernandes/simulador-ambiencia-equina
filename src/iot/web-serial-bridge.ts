/**
 * web-serial-bridge.ts
 *
 * Ponte para Arduino físico via Web Serial API.
 * Implementa ArduinoInterface usando CompactSerialAdapter.
 */

import type {
  ArduinoInterface,
  CommandCallback,
  LogCallback,
} from '../hal/arduino-interface.ts';
import type { ActuatorCommandMessage, SensorDataMessage } from '../hal/canonical-message.ts';
import { CompactSerialAdapter } from '../hal/adapters/compact-serial-adapter.ts';
import type { ProtocolMessage } from '../iot/message-schema.ts';

export type LegacyMessageCallback = (message: ProtocolMessage) => void;

export class WebSerialBridge implements ArduinoInterface {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private buffer = '';
  private isReading = false;

  private commandCallbacks = new Set<CommandCallback>();
  private logCallbacks = new Set<LogCallback>();
  private legacyCallbacks = new Set<LegacyMessageCallback>();

  private lastFan1 = false;
  private lastFan2 = false;
  private lastMode: SensorDataMessage['mode'] = 'AUTO';

  get isConnected(): boolean {
    return !!this.port?.readable;
  }

  async connect(baudRate = 9600): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API não é suportada neste navegador.');
    }

    this.log('Solicitando porta serial...');
    this.port = await (navigator as any).serial.requestPort();
    await this.port.open({ baudRate });
    this.log('Porta serial aberta com sucesso!');
    this.readLoop();
  }

  async disconnect(): Promise<void> {
    this.isReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        /* ignorar */
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        await this.writer.close();
      } catch {
        /* ignorar */
      }
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        /* ignorar */
      }
      this.port = null;
    }

    this.log('Conexão serial encerrada.');
    this.emitLegacy({
      type: 'connection_lost',
      timestamp: Date.now(),
      payload: { lastHeartbeat: Date.now(), timeoutMs: 0 },
    });
  }

  async sendSensorData(data: SensorDataMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Não conectado à porta serial.');
    }

    this.lastMode = data.mode;
    const line =
      CompactSerialAdapter.encodeSensorData(data, this.lastFan1, this.lastFan2) + '\n';

    await this.writeRaw(line);
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

  /** Compatibilidade com handlers legados de ProtocolMessage */
  onLegacyMessage(callback: LegacyMessageCallback): void {
    this.legacyCallbacks.add(callback);
  }

  offLegacyMessage(callback: LegacyMessageCallback): void {
    this.legacyCallbacks.delete(callback);
  }

  private async writeRaw(payload: string): Promise<void> {
    if (!this.port?.writable) {
      throw new Error('Porta serial não disponível para escrita.');
    }

    try {
      if (!this.writer) {
        const textEncoder = new TextEncoderStream();
        textEncoder.readable.pipeTo(this.port.writable);
        this.writer = textEncoder.writable.getWriter();
      }

      this.log(`TX: ${payload.trim()}`);
      await this.writer.write(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`ERRO de transmissão: ${msg}`);
      throw err;
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;

    this.isReading = true;
    const textDecoder = new TextDecoderStream();
    this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) break;

        this.buffer += value;
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          const clean = line.trim();
          if (clean) {
            this.log(`RX: ${clean}`);
            this.parseLine(clean);
          }
        }
      }
    } catch (err: unknown) {
      if (this.isReading) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`ERRO de leitura serial: ${msg}`);
        await this.disconnect();
      }
    } finally {
      this.reader?.releaseLock();
    }
  }

  private parseLine(line: string): void {
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const parsed = JSON.parse(line) as ProtocolMessage;
        if (parsed.type) {
          this.emitLegacy(parsed);
          return;
        }
      } catch {
        /* não é JSON válido */
      }
    }

    const ack = CompactSerialAdapter.decodeActuatorCommand(line, this.lastMode);
    if (ack) {
      this.lastFan1 = ack.actuators.fan_1;
      this.lastFan2 = ack.actuators.fan_2;
      this.emitCommand(ack);
      this.emitLegacyHeartbeat();
      return;
    }

    this.parseLegacyPortugueseLine(line);
  }

  private parseLegacyPortugueseLine(line: string): void {
    const humidityMatch = line.match(/Umidade:\s*([\d.]+)/i);
    const tempMatch = line.match(/Temperatura:\s*([\d.]+)/i);
    const fanMatch = line.match(
      /Ventilador:\s*\[\s*(LIGADO|DESLIGADO|FAN ATIVO|ACTIVE|ON|OFF)/i
    );

    if (!humidityMatch || !tempMatch) return;

    const rh = parseFloat(humidityMatch[1]);
    const temp = parseFloat(tempMatch[1]);
    let fanOn = false;

    if (fanMatch) {
      const stateStr = fanMatch[1].toUpperCase();
      fanOn =
        stateStr.includes('LIGADO') ||
        stateStr.includes('ATIVO') ||
        stateStr.includes('ACTIVE') ||
        stateStr.includes('ON');
    }

    this.emitLegacyHeartbeat();
    this.emitLegacy({
      type: 'fan_state',
      timestamp: Date.now(),
      payload: {
        fanId: 'fan-exhaust-01',
        isOn: fanOn,
        rpm: fanOn ? 1200 : 0,
        currentAmps: fanOn ? 3.4 : 0,
        state: fanOn ? 'running' : 'off',
      },
    });

    window.dispatchEvent(
      new CustomEvent('arduinoData', { detail: { temp, rh, fanOn } })
    );
  }

  private emitLegacyHeartbeat(): void {
    this.emitLegacy({
      type: 'heartbeat',
      timestamp: Date.now(),
      payload: { uptimeMs: Date.now(), sensorOk: true },
    });
  }

  private emitCommand(command: ActuatorCommandMessage): void {
    this.commandCallbacks.forEach((cb) => cb(command));
  }

  private emitLegacy(message: ProtocolMessage): void {
    this.legacyCallbacks.forEach((cb) => cb(message));
  }

  private log(message: string): void {
    this.logCallbacks.forEach((cb) => cb(message));
  }
}
