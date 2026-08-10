/**
 * sensor-health-panel.ts
 * 
 * Painel de Diagnóstico de Sensores do Gêmeo Digital.
 * 
 * Apresenta a saúde em tempo real de cada sensor e rede física IoT.
 */

import { DigitalTwinStore } from '../../sim/state/global-state.ts';
import { DEVICE_REGISTRY } from '../../iot/device-registry.ts';

export class SensorHealthPanel {
  private store: DigitalTwinStore;
  private containerEl: HTMLElement | null = null;
  
  constructor(store: DigitalTwinStore) {
    this.store = store;
    this.buildPanel();
    this.subscribeToStore();
  }
  
  /**
   * Constrói o container de saúde e injeta na aba Arduino IoT.
   */
  private buildPanel(): void {
    const parentContainer = document.getElementById('tab-arduino');
    if (!parentContainer) return;
    
    const panelSection = document.createElement('div');
    panelSection.className = 'control-section-premium';
    panelSection.style.marginTop = '20px';
    panelSection.innerHTML = `
      <h2 class="section-title">Diagnóstico de Hardware & Sensores</h2>
      <div id="sensor-health-grid" style="display:flex; flex-direction:column; gap:8px; background:rgba(0,0,0,0.25); padding:12px; border-radius:8px;">
        <div style="font-size:0.75rem; color:var(--text-secondary); text-align:center;">Nenhum sensor físico ativo. Conecte o serial.</div>
      </div>
    `;
    
    parentContainer.appendChild(panelSection);
    this.containerEl = document.getElementById('sensor-health-grid');
    this.renderGrid();
  }
  
  /** Subscreve no store para receber updates de conexão ou desvios */
  private subscribeToStore(): void {
    this.store.subscribe('sensor-health-panel', (_state, changedKeys) => {
      if (changedKeys.has('sensorHealth') || changedKeys.has('arduinoConnectionStatus')) {
        this.renderGrid();
      }
    });
  }
  
  /**
   * Renderiza a grade de status dos sensores registrados.
   */
  private renderGrid(): void {
    if (!this.containerEl) return;
    
    const state = this.store.getState();
    const isConnected = state.arduinoConnectionStatus === 'connected';
    
    let html = '';
    
    // Pegar sensores no dispositivo e na saúde
    const sensorKeys = ['sensor-temp-dht', 'sensor-rh-dht'];
    
    sensorKeys.forEach(key => {
      const dev = DEVICE_REGISTRY[key];
      if (!dev) return;
      
      // Mapear health correspondente do store
      const storeHealthKey = key === 'sensor-temp-dht' ? 'dht11-temp' : 'dht11-rh';
      const health = state.sensorHealth[storeHealthKey];
      
      const status = isConnected ? (health?.status || 'ok') : 'offline';
      
      let statusColor = 'var(--text-secondary)';
      let statusText = 'OFFLINE';
      let dotClass = 'status-dot offline';
      
      if (isConnected) {
        switch (status) {
          case 'ok':
            statusColor = 'var(--color-green)';
            statusText = 'OPERACIONAL';
            dotClass = 'status-dot';
            break;
          case 'warning':
            statusColor = 'var(--color-amber)';
            statusText = 'DESVIO DETECTADO';
            dotClass = 'status-dot warning';
            break;
          case 'fault':
            statusColor = 'var(--color-red)';
            statusText = 'FALHA DE LEITURA';
            dotClass = 'status-dot offline';
            break;
        }
      }
      
      // Valor atual exibido
      let valDisplay = 'N/A';
      if (isConnected && health) {
        valDisplay = health.lastValue.toFixed(1) + (dev.unit || '');
      }
      
      html += `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:0.75rem; font-weight:600; color:var(--text-primary);">${dev.name}</span>
            <span style="font-size:0.6rem; color:var(--text-secondary);">${dev.location} (${dev.model})</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:0.7rem; color:var(--text-primary);">${valDisplay}</strong>
            <div style="display:flex; align-items:center; gap:4px; background:rgba(0,0,0,0.15); padding:3px 6px; border-radius:4px;">
              <div class="${dotClass}" style="width:6px; height:6px;"></div>
              <span style="font-size:0.55rem; font-weight:700; color:${statusColor};">${statusText}</span>
            </div>
          </div>
        </div>
      `;
    });
    
    this.containerEl.innerHTML = html;
  }
}
