/**
 * command-log.ts
 * 
 * Histórico e visualizador de comandos em tempo real.
 */

import { DigitalTwinStore } from '../sim/state/global-state.ts';

export class CommandLog {
  private store: DigitalTwinStore;
  private containerEl: HTMLElement | null = null;
  
  constructor(store: DigitalTwinStore) {
    this.store = store;
    this.buildLogContainer();
    this.subscribeToStore();
  }
  
  /**
   * Constrói o elemento visual do log de comandos.
   */
  private buildLogContainer(): void {
    const parentContainer = document.getElementById('tab-arduino');
    if (!parentContainer) return;
    
    const logSection = document.createElement('div');
    logSection.className = 'control-section-premium';
    logSection.style.marginTop = '20px';
    logSection.innerHTML = `
      <h2 class="section-title">Histórico de Comandos (Atuações)</h2>
      <div id="command-log-list" style="display:flex; flex-direction:column; gap:4px; max-height:150px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; font-family:monospace; font-size:0.65rem; border:1px solid rgba(255,255,255,0.05);">
        <div style="color:var(--text-secondary); text-align:center;">Nenhum comando registrado no loop.</div>
      </div>
    `;
    
    parentContainer.appendChild(logSection);
    this.containerEl = document.getElementById('command-log-list');
    this.renderLog();
  }
  
  /** Subscreve no store */
  private subscribeToStore(): void {
    this.store.subscribe('command-log-panel', (_state, changedKeys) => {
      if (changedKeys.has('commandLog')) {
        this.renderLog();
      }
    });
  }
  
  /**
   * Renderiza a lista de comandos a partir do store
   */
  private renderLog(): void {
    if (!this.containerEl) return;
    
    const state = this.store.getState();
    const logs = state.commandLog;
    
    if (logs.length === 0) {
      this.containerEl.innerHTML = `<div style="color:var(--text-secondary); text-align:center;">Nenhum comando registrado no loop.</div>`;
      return;
    }
    
    let html = '';
    // Mostrar os mais recentes primeiro
    for (let i = logs.length - 1; i >= 0; i--) {
      const entry = logs[i];
      const timeStr = new Date(entry.timestamp).toLocaleTimeString();
      
      let sourceBadgeColor = 'var(--text-secondary)';
      if (entry.source === 'auto') sourceBadgeColor = 'var(--color-blue)';
      if (entry.source === 'arduino') sourceBadgeColor = 'var(--color-amber)';
      if (entry.source === 'manual') sourceBadgeColor = 'var(--color-cyan)';
      
      const actionColor = entry.action === 'LIGAR' ? 'var(--color-green)' : 'var(--text-secondary)';
      
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.02);">
          <span style="color:var(--text-secondary);">${timeStr}</span>
          <span style="background:rgba(255,255,255,0.05); padding:1px 4px; border-radius:3px; font-weight:700; color:${sourceBadgeColor}">${entry.source.toUpperCase()}</span>
          <span style="color:var(--text-primary); font-weight:600;">${entry.target}</span>
          <strong style="color:${actionColor}">${entry.action}</strong>
        </div>
      `;
    }
    
    this.containerEl.innerHTML = html;
  }
}
