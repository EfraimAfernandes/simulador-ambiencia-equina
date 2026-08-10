/**
 * fan-controller.ts
 * 
 * Controlador de ventiladores com dinâmica temporal realista.
 * 
 * Cada instância modela um ventilador individual com:
 * - Estados: off → starting → running → stopping → off (e fault)
 * - Curva de partida exponencial (ramp-up)
 * - Curva de parada com inércia (ramp-down)
 * - Consumo energético proporcional ao RPM³ (lei de afinidade)
 * - Vazão proporcional ao RPM (relação linear simplificada)
 * - Acumulação de horas de operação
 * - Detecção de falhas simuladas
 * 
 * O controlador NÃO decide quando ligar/desligar — apenas executa
 * comandos e modela a dinâmica de resposta. A decisão vem do
 * módulo de regras de controle (control-rules.ts, Fase 3).
 */

import type { ActuatorState, FanState } from '../iot/message-schema.ts';
import { createDefaultFanState } from '../iot/message-schema.ts';

export class FanController {
  private state: FanState;
  
  /** Progresso da rampa de 0.0 (parado) a 1.0 (RPM nominal) */
  private rampProgress = 0;
  
  /** Comando atual: o ventilador deve estar ligado? */
  private targetOn = false;

  
  constructor(id: string, options?: Partial<FanState>) {
    this.state = {
      ...createDefaultFanState(id),
      ...options,
    };
  }
  
  /** Lê o estado atual do ventilador (snapshot) */
  getState(): Readonly<FanState> {
    return this.state;
  }
  
  /** ID do ventilador */
  get id(): string {
    return this.state.id;
  }
  
  /** RPM atual */
  get rpm(): number {
    return this.state.rpm;
  }
  
  /** Vazão atual em m³/h */
  get flowRate(): number {
    return this.state.currentFlowRate;
  }
  
  /** Consumo atual em Watts */
  get power(): number {
    return this.state.powerConsumption;
  }
  
  /** Estado lógico do atuador */
  get actuatorState(): ActuatorState {
    return this.state.state;
  }
  
  /** Se o ventilador está efetivamente gerando vazão */
  get isProducingFlow(): boolean {
    return this.rampProgress > 0.01;
  }
  
  /** Fração de potência efetiva (0.0 a 1.0) — usada para interpolar efeitos físicos */
  get efficiency(): number {
    return this.smoothedProgress;
  }
  
  /**
   * Comanda o ventilador para ligar.
   * O efeito é gradual — o RPM sobe ao longo de rampUpTime segundos.
   */
  turnOn(): void {
    if (this.state.state === 'fault') return; // Não permite ligar em falha
    this.targetOn = true;
    this.state.lastCommandTimestamp = Date.now();
  }
  
  /**
   * Comanda o ventilador para desligar.
   * O RPM cai gradualmente ao longo de rampDownTime segundos.
   */
  turnOff(): void {
    this.targetOn = false;
    this.state.lastCommandTimestamp = Date.now();
  }
  
  /**
   * Força o ventilador em estado de falha.
   * Para imediatamente (sem rampa) e bloqueia novos comandos.
   */
  setFault(): void {
    this.state.state = 'fault';
    this.targetOn = false;
  }
  
  /**
   * Limpa o estado de falha e permite novos comandos.
   */
  clearFault(): void {
    if (this.state.state === 'fault') {
      this.state.state = 'off';
      this.rampProgress = 0;
    }
  }
  
  /**
   * Atualiza a dinâmica do ventilador por um passo de tempo dt (segundos reais).
   * 
   * Modelo:
   * - Ramp-up: progresso sobe linearmente em rampUpTime segundos
   * - Ramp-down: progresso desce linearmente em rampDownTime segundos
   * - Suavização: curva hermite (smoothstep) para resposta natural
   * - Consumo: proporcional ao cubo do RPM relativo (lei de afinidade de ventiladores)
   * - Vazão: proporcional ao RPM (simplificação da lei de afinidade para vazão)
   * 
   * @param dtReal Delta time em segundos reais (não simulados)
   */
  update(dtReal: number): void {
    // ─── Tratamento de Falha ───────────────────────────────────────
    if (this.state.state === 'fault') {
      // Em falha: desacelera rapidamente (emergência)
      this.rampProgress = Math.max(0, this.rampProgress - dtReal * 2.0);
      this.updateDerivedValues();
      return;
    }
    
    // ─── Rampa de Aceleração / Desaceleração ───────────────────────
    if (this.targetOn) {
      const rampRate = 1.0 / this.state.rampUpTime;
      this.rampProgress = Math.min(1.0, this.rampProgress + rampRate * dtReal);
    } else {
      const rampRate = 1.0 / this.state.rampDownTime;
      this.rampProgress = Math.max(0.0, this.rampProgress - rampRate * dtReal);
    }
    
    // ─── Determinar Estado Lógico ──────────────────────────────────
    if (this.rampProgress <= 0.001) {
      this.state.state = 'off';
    } else if (this.rampProgress >= 0.98 && this.targetOn) {
      this.state.state = 'running';
    } else if (this.targetOn) {
      this.state.state = 'starting';
    } else {
      this.state.state = 'stopping';
    }
    
    // ─── Acumular Horas de Operação ────────────────────────────────
    if (this.state.state === 'running') {
      this.state.hoursOfOperation += dtReal / 3600;
    }
    
    // ─── Atualizar Valores Derivados ───────────────────────────────
    this.updateDerivedValues();
  }
  
  /**
   * Calcula RPM, vazão e consumo a partir do progresso da rampa.
   */
  private updateDerivedValues(): void {
    const smooth = this.smoothedProgress;
    
    // RPM proporcional à rampa suavizada
    this.state.rpm = smooth * this.state.maxRpm;
    
    // Vazão proporcional ao RPM (1ª lei de afinidade: Q ∝ N)
    this.state.currentFlowRate = smooth * this.state.nominalFlowRate;
    
    // Consumo proporcional ao cubo do RPM relativo (3ª lei de afinidade: P ∝ N³)
    // Na prática com motor elétrico, a relação é menos extrema — usamos N² como compromisso
    const powerFraction = smooth * smooth; // N² simplificado
    this.state.powerConsumption = powerFraction * this.state.nominalPower;
  }
  
  /**
   * Progresso da rampa suavizado pela curva hermite (smoothstep).
   * Evita transições abruptas no início e no final.
   * 
   * smoothstep(t) = t² × (3 - 2t)
   */
  private get smoothedProgress(): number {
    const t = this.rampProgress;
    return t * t * (3 - 2 * t);
  }
  
  /**
   * Calcula a energia consumida neste step (Wh).
   * Deve ser acumulada externamente no store.
   */
  getEnergyConsumedThisStep(dtReal: number): number {
    return (this.state.powerConsumption * dtReal) / 3600;
  }
  
  /**
   * Reseta o ventilador ao estado inicial (desligado).
   */
  reset(): void {
    this.rampProgress = 0;
    this.targetOn = false;
    this.state.state = 'off';
    this.state.rpm = 0;
    this.state.currentFlowRate = 0;
    this.state.powerConsumption = 0;
    this.state.hoursOfOperation = 0;
  }
}
