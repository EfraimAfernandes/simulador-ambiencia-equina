/**
 * automation-panel.ts
 * 
 * Painel UI para controle de setpoints e parâmetros de automação.
 * 
 * Permite configurar:
 * - Setpoint de temperatura máxima (liga exaustor)
 * - Setpoint de temperatura mínima (desliga exaustor)
 * - Setpoint de umidade crítica
 * - Visualizar status lógico e alarmes ativos
 */

import { DigitalTwinStore } from '../../sim/state/global-state.ts';

export class AutomationPanel {
  private store: DigitalTwinStore;
  
  // Elementos HTML de configuração
  private tempHighInput: HTMLInputElement | null = null;
  private tempLowInput: HTMLInputElement | null = null;
  private rhHighInput: HTMLInputElement | null = null;
  
  private tempHighValLabel: HTMLElement | null = null;
  private tempLowValLabel: HTMLElement | null = null;
  private rhHighValLabel: HTMLElement | null = null;
  
  constructor(store: DigitalTwinStore) {
    this.store = store;
    this.buildPanelElements();
    this.bindEvents();
    this.subscribeToStore();
  }
  
  /**
   * Vincula ou cria os controles HTML dinamicamente.
   */
  private buildPanelElements(): void {
    const parentContainer = document.getElementById('tab-ventilation');
    if (!parentContainer) return;
    
    // Inserir seção de setpoints customizados na aba de Ventilação
    const setpointSection = document.createElement('div');
    setpointSection.className = 'control-section-premium';
    setpointSection.innerHTML = `
      <h2 class="section-title" style="margin-top: 15px;">Setpoints de Ambiência</h2>
      
      <div class="control-group">
        <label class="control-label">
          Temp. Máxima (Acionar): 
          <span class="control-val"><span id="val-set-t-high">28</span> °C</span>
        </label>
        <input type="range" id="slide-set-t-high" min="25.5" max="35" step="0.5" value="28">
      </div>
      
      <div class="control-group">
        <label class="control-label">
          Temp. Mínima (Desligar): 
          <span class="control-val"><span id="val-set-t-low">25</span> °C</span>
        </label>
        <input type="range" id="slide-set-t-low" min="18" max="25" step="0.5" value="25">
      </div>
      
      <div class="control-group">
        <label class="control-label">
          Umidade Crítica (Sanitária): 
          <span class="control-val"><span id="val-set-rh-high">80</span> %</span>
        </label>
        <input type="range" id="slide-set-rh-high" min="70" max="95" step="5" value="80">
      </div>
    `;
    
    // Inserir antes da seção de ventilação mecânica para fluxo lógico
    const mechanicalSectionHeader = Array.from(parentContainer.querySelectorAll('.section-title'))
      .find(el => el.textContent?.includes('Mecânica'));
      
    if (mechanicalSectionHeader) {
      parentContainer.insertBefore(setpointSection, mechanicalSectionHeader);
    } else {
      parentContainer.appendChild(setpointSection);
    }
    
    // Buscar elementos
    this.tempHighInput = document.getElementById('slide-set-t-high') as HTMLInputElement;
    this.tempLowInput = document.getElementById('slide-set-t-low') as HTMLInputElement;
    this.rhHighInput = document.getElementById('slide-set-rh-high') as HTMLInputElement;
    
    this.tempHighValLabel = document.getElementById('val-set-t-high');
    this.tempLowValLabel = document.getElementById('val-set-t-low');
    this.rhHighValLabel = document.getElementById('val-set-rh-high');
  }
  
  /**
   * Vincula os listeners de input para atualizar o store reativo
   */
  private bindEvents(): void {
    const updateSetpoints = () => {
      const state = this.store.getState();
      const tempHigh = this.tempHighInput ? parseFloat(this.tempHighInput.value) : 28;
      const tempLow = this.tempLowInput ? parseFloat(this.tempLowInput.value) : 25;
      const rhHigh = this.rhHighInput ? parseFloat(this.rhHighInput.value) : 80;
      
      this.store.update({
        setpoints: {
          ...state.setpoints,
          temperatureHigh: tempHigh,
          temperatureLow: tempLow,
          humidityHigh: rhHigh
        }
      });
      
      if (this.tempHighValLabel) this.tempHighValLabel.textContent = tempHigh.toFixed(1);
      if (this.tempLowValLabel) this.tempLowValLabel.textContent = tempLow.toFixed(1);
      if (this.rhHighValLabel) this.rhHighValLabel.textContent = rhHigh.toFixed(0);
    };
    
    this.tempHighInput?.addEventListener('input', updateSetpoints);
    this.tempLowInput?.addEventListener('input', updateSetpoints);
    this.rhHighInput?.addEventListener('input', updateSetpoints);
  }
  
  /** Subscreve no store para sincronizar os inputs se o estado mudar externamente */
  private subscribeToStore(): void {
    this.store.subscribe('automation-panel', (state, changedKeys) => {
      if (changedKeys.has('setpoints')) {
        if (this.tempHighInput) this.tempHighInput.value = state.setpoints.temperatureHigh.toString();
        if (this.tempLowInput) this.tempLowInput.value = state.setpoints.temperatureLow.toString();
        if (this.rhHighInput) this.rhHighInput.value = state.setpoints.humidityHigh.toString();
        
        if (this.tempHighValLabel) this.tempHighValLabel.textContent = state.setpoints.temperatureHigh.toFixed(1);
        if (this.tempLowValLabel) this.tempLowValLabel.textContent = state.setpoints.temperatureLow.toFixed(1);
        if (this.rhHighValLabel) this.rhHighValLabel.textContent = state.setpoints.humidityHigh.toFixed(0);
      }
    });
  }
}
