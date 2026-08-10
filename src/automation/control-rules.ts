/**
 * control-rules.ts
 * 
 * Motor de Regras de Automação do Gêmeo Digital Equino.
 * 
 * Concentra as políticas e lógicas operacionais:
 * 1. Histerese clássica de temperatura (evita desgaste elétrico dos relés)
 * 2. Histerese de umidade (ativa ventilação em picos de umidade)
 * 3. Abertura inteligente de cortinas baseada no vento e chuva (simulada)
 * 4. Alertas de estresse calórico
 */

import { Setpoints, HysteresisBands } from '../iot/message-schema.ts';

/** Resultado da avaliação de regras de controle */
export interface AutomationDecisionResult {
  /** Se o ventilador deve estar ligado */
  fanTargetOn: boolean;
  /** Sugestão de abertura de cortinas (0 a 1) */
  suggestedCurtainOpening: boolean;
  curtainOpeningValue?: number;
  /** Ações automáticas disparadas (mensagens de log) */
  actions: string[];
}

export class ControlRules {
  /**
   * Avalia as regras de automação térmicas e de umidade.
   * 
   * @param currentTemp Temperatura filtrada atual (°C)
   * @param currentRH Umidade filtrada atual (%)
   * @param wasFanOn Estado anterior do ventilador (evita oscilação na banda)
   * @param setpoints Setpoints operacionais configurados
   * @param _bands Bandas de histerese configuradas
   * @returns Decisão de controle e logs de ações
   */
  static evaluate(
    currentTemp: number,
    currentRH: number,
    wasFanOn: boolean,
    setpoints: Setpoints,
    _bands: HysteresisBands
  ): AutomationDecisionResult {
    let fanTargetOn = wasFanOn;
    const actions: string[] = [];
    
    // ─── 1. Histerese de Temperatura ────────────────────────────────
    // Limiar superior: liga ventiladores para resfriamento sensível
    const tempUpper = setpoints.temperatureHigh;
    // Limiar inferior: desliga ventiladores
    const tempLower = setpoints.temperatureLow;
    
    if (currentTemp >= tempUpper && !wasFanOn) {
      fanTargetOn = true;
      actions.push(`Temperatura interna (${currentTemp.toFixed(1)}°C) atingiu ou superou o setpoint de ativação (${tempUpper}°C). Exaustores ativados.`);
    } else if (currentTemp <= tempLower && wasFanOn) {
      fanTargetOn = false;
      actions.push(`Temperatura interna (${currentTemp.toFixed(1)}°C) resfriou abaixo do setpoint de desligamento (${tempLower}°C). Exaustores desativados.`);
    }
    
    // ─── 2. Histerese de Umidade (Segurança Sanitária) ──────────────
    // Se a temperatura estiver na faixa neutra, mas a umidade relativa
    // exceder o limite sanitário (ex: 80% RH), ativa ventilação
    // para remoção de gases nocivos (amônia) e vapor.
    if (currentRH >= setpoints.humidityHigh && !fanTargetOn) {
      fanTargetOn = true;
      actions.push(`ALERTA SANITÁRIO: Umidade interna atingiu ${currentRH.toFixed(0)}% (limiar: ${setpoints.humidityHigh}%). Ativando exaustores para renovação do ar e secagem da cama.`);
    } else if (currentRH <= setpoints.humidityLow && fanTargetOn && currentTemp < tempUpper) {
      // Desliga se umidade normalizar e temperatura estiver baixa
      fanTargetOn = false;
      actions.push(`Umidade interna normalizou para ${currentRH.toFixed(0)}%. Exaustores desligados.`);
    }
    
    // ─── 3. Controle Inteligente de Cortinas (Natural) ──────────────
    // Se a umidade ou temperatura estiverem subindo e os ventiladores
    // estiverem ligados, as cortinas devem abrir para entrada de ar.
    // Se a temperatura estiver muito fria externa ou vento muito forte,
    // recomenda fechar.
    let suggestedCurtainOpening = true;
    let curtainOpeningValue = 0.5; // 50% padrão
    
    if (currentTemp > tempUpper + 2.0) {
      curtainOpeningValue = 1.0; // Abre tudo para convecção natural
      actions.push(`Calor severo detectado. Sugerido abertura máxima de cortinas.`);
    } else if (currentTemp < tempLower - 2.0) {
      curtainOpeningValue = 0.15; // Fecha quase tudo para retenção de calor metabólico
      actions.push(`Frio detectado. Sugerido fechamento de cortinas para preservação térmica.`);
    }
    
    return {
      fanTargetOn,
      suggestedCurtainOpening,
      curtainOpeningValue,
      actions
    };
  }
}
