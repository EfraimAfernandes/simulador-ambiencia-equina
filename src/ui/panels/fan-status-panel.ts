/**
 * fan-status-panel.ts
 * 
 * Painel UI para monitoramento operacional detalhado de exaustores e atuadores.
 * 
 * Funcionalidades:
 * - Exibe RPM, vazão, potência consumida e horas de operação acumuladas
 * - Permite simular injeção de falhas físicas (teste de redundância e alarmes)
 * - Apresenta o status lógico de controle e acumulação de energia
 */

import { DigitalTwinStore } from '../../sim/state/global-state.ts';

export class FanStatusPanel {
  private store: DigitalTwinStore;
  private containerEl: HTMLElement | null = null;
  
  constructor(store: DigitalTwinStore) {
    this.store = store;
    this.buildPanel();
    this.subscribeToStore();
  }
  
  /** Injeta o painel de ventiladores na aba de Ventilação */
  private buildPanel(): void {
    const parentContainer = document.getElementById('tab-ventilation');
    if (!parentContainer) return;
    
    const panelSection = document.createElement('div');
    panelSection.className = 'control-section-premium';
    panelSection.style.marginTop = '15px';
    panelSection.innerHTML = `
      <h2 class="section-title">Status Detalhado dos Atuadores</h2>
      <div id="fan-status-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
        <!-- Injetado dinamicamente -->
      </div>
      <div style="margin-top: 10px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); padding:8px; border-radius:6px; font-size:0.7rem;">
        <span style="color:var(--text-secondary);">Consumo Total Acumulado:</span>
        <strong id="val-total-kwh" style="color:var(--color-cyan);">0.000 kWh</strong>
      </div>
    `;
    
    parentContainer.appendChild(panelSection);
    this.containerEl = document.getElementById('fan-status-grid');
    this.renderStatus();
  }
  
  /** Subscreve às mudanças de estado dos exaustores */
  private subscribeToStore(): void {
    this.store.subscribe('fan-status-panel', (_state, changedKeys) => {
      if (changedKeys.has('fanStates') || changedKeys.has('energyConsumptionActuators')) {
        this.renderStatus();
      }
    });
  }
  
  /** Renderiza os dados operacionais e os botões de simulação de falha */
  private renderStatus(): void {
    if (!this.containerEl) return;
    
    const state = this.store.getState();
    let html = '';
    
    state.fanStates.forEach((fan) => {
      let statusColor = 'var(--text-secondary)';
      let statusText = fan.state.toUpperCase();
      
      switch (fan.state) {
        case 'running':
          statusColor = 'var(--color-green)';
          break;
        case 'starting':
          statusColor = 'var(--color-amber)';
          break;
        case 'stopping':
          statusColor = 'var(--color-cyan)';
          break;
        case 'fault':
          statusColor = 'var(--color-red)';
          statusText = 'FALHA';
          break;
      }
      
      const isFault = fan.state === 'fault';
      const faultButtonText = isFault ? 'Recuperar' : 'Injetar Falha';
      const faultButtonClass = isFault ? 'btn-ack-single' : 'btn-ack-single btn-danger-log';
      
      html += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
            <strong style="font-size:0.7rem; color:var(--text-primary);">${fan.id === 'fan-exhaust-01' ? 'Exaustor 1' : 'Exaustor 2'}</strong>
            <span style="font-size:0.6rem; font-weight:700; color:${statusColor};">${statusText}</span>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:2px; font-size:0.6rem; color:var(--text-secondary);">
            <div style="display:flex; justify-content:space-between;">
              <span>Velocidade:</span>
              <strong style="color:var(--text-primary);">${fan.rpm.toFixed(0)} RPM</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Vazão:</span>
              <strong style="color:var(--text-primary);">${fan.currentFlowRate.toFixed(0)} m³/h</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Potência:</span>
              <strong style="color:var(--text-primary);">${fan.powerConsumption.toFixed(0)} W</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Operação:</span>
              <strong style="color:var(--text-primary);">${fan.hoursOfOperation.toFixed(4)} h</strong>
            </div>
          </div>
          
          <button class="${faultButtonClass}" data-fan-id="${fan.id}" style="font-size:0.55rem; width:100%; border:none; padding:4px; margin-top:2px; cursor:pointer; border-radius:4px; font-weight:600;">
            ${faultButtonText}
          </button>
        </div>
      `;
    });
    
    this.containerEl.innerHTML = html;
    
    // Atualizar consumo de energia total em kWh
    const kwhEl = document.getElementById('val-total-kwh');
    if (kwhEl) {
      kwhEl.textContent = `${state.energyConsumptionActuators.toFixed(4)} kWh`;
    }
    
    // Adicionar listeners nos botões de falha
    this.containerEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const fanId = target.getAttribute('data-fan-id')!;
        
        // Disparar evento customizado que o App ouvirá para comandar a falha física no controlador correspondente
        window.dispatchEvent(new CustomEvent('toggleFanFault', {
          detail: { fanId }
        }));
      });
    });
  }
}
