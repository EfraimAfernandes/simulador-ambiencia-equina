/**
 * device-registry.ts
 * 
 * Registro central de dispositivos e sensores do Gêmeo Digital.
 * 
 * Mapeia IDs lógicos a metadados operacionais e zootécnicos.
 */


export interface DeviceMetadata {
  id: string;
  type: 'sensor' | 'actuator';
  name: string;
  description: string;
  location: string;          // Onde está instalado na instalação (ex: "Baia 1", "Parede Traseira")
  unit?: string;             // Unidade de medida (para sensores)
  model: string;             // Modelo do hardware (ex: "DHT11", "Exaustor Axial 60cm")
  minRange?: number;         // Limites físicos de operação
  maxRange?: number;
}

export const DEVICE_REGISTRY: Record<string, DeviceMetadata> = {
  // ─── Sensores ──────────────────────────────────────────────────────
  'sensor-temp-dht': {
    id: 'sensor-temp-dht',
    type: 'sensor',
    name: 'Sensor Temperatura DHT11',
    description: 'Mede a temperatura externa do ar na entrada',
    location: 'Entrada de ar (Cortina)',
    unit: '°C',
    model: 'DHT11',
    minRange: 0,
    maxRange: 50
  },
  'sensor-rh-dht': {
    id: 'sensor-rh-dht',
    type: 'sensor',
    name: 'Sensor Umidade Relativa DHT11',
    description: 'Mede a umidade relativa externa',
    location: 'Entrada de ar (Cortina)',
    unit: '%',
    model: 'DHT11',
    minRange: 20,
    maxRange: 90
  },
  
  // ─── Atuadores ─────────────────────────────────────────────────────
  'fan-exhaust-01': {
    id: 'fan-exhaust-01',
    type: 'actuator',
    name: 'Exaustor Principal Esquerdo',
    description: 'Remoção forçada de ar quente e úmido',
    location: 'Parede Traseira - Esquerda',
    model: 'Exaustor Axial Trifásico 60cm'
  },
  'fan-exhaust-02': {
    id: 'fan-exhaust-02',
    type: 'actuator',
    name: 'Exaustor Principal Direito',
    description: 'Remoção forçada de ar quente e úmido',
    location: 'Parede Traseira - Direita',
    model: 'Exaustor Axial Trifásico 60cm'
  },
  'curtain-natural': {
    id: 'curtain-natural',
    type: 'actuator',
    name: 'Cortina Longitudinal Móvel',
    description: 'Ventilação natural cruzada ajustável por abertura vertical',
    location: 'Laterais do Galpão',
    model: 'Cortina Vinílica com Catraca Manual'
  }
};
