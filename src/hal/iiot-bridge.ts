/**
 * iiot-bridge.ts
 *
 * Contrato de transporte serial (camada abaixo dos adaptadores).
 */

export type DataCallback = (line: string) => void;
export type TransportLogCallback = (message: string) => void;

export interface IIoTBridge {
  readonly isConnected: boolean;

  connect(baudRate?: number): Promise<void>;
  disconnect(): Promise<void>;
  send(line: string): Promise<void>;
  onData(callback: DataCallback): void;
  offData(callback: DataCallback): void;
  onLog(callback: TransportLogCallback): void;
  offLog(callback: TransportLogCallback): void;
}
