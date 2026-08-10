/**
 * alarm-log.ts
 * 
 * Histórico e visualizador de alarmes operacionais em tempo real.
 */

import { DigitalTwinStore } from '../sim/state/global-state.ts';

export class AlarmLog {
  private store: DigitalTwinStore;
  private containerEl: HTMLElement | null = null;
  
  constructor(store: DigitalTwinStore) {
    this.store = store;
    this.buildAlarmContainer();
    this.subscribeToStore();
  }
  
  /**
   * Constrói a UI para exibir alarmes.
   * Criamos uma seção no topo do painel principal para dar visibilidade crítica.
   */
  private buildAlarmContainer(): void {
    const parentContainer = document.getElementById('dashboard-panel');
    if (!parentContainer) return;
    
    // Inserir painel de alarmes flutuante ou como coluna adicional no footer
    const alarmCol = document.createElement('div');
    alarmCol.className = 'dashboard-col';
    alarmCol.id = 'alarm-log-col';
    alarmCol.innerHTML = `
      <div class="col-header" style="color:var(--color-red); display:flex; align-items:center; justify-content:space-between;">
        <span>Alertas & Alarmes</span>
        <button id="btn-ack-all-alarms" style="font-size:0.55rem; background:rgba(239,68,68,0.2); border:1px solid var(--color-red); color:var(--text-primary); padding:2px 6px; border-radius:4px; cursor:pointer;">Limpar Tudo</button>
      </div>
      <div id="alarm-log-list" style="display:flex; flex-direction:column; gap:4px; height:120px; overflow-y:auto; padding:5px; border-radius:6px; background:rgba(0,0,0,0.25);">
        <div style="font-size:0.7rem; color:var(--text-secondary); text-align:center; margin-top:20px;">Nenhum alarme operacional ativo.</div>
      </div>
    `;
    
    // Adicionar como penúltimo elemento no painel do rodapé
    parentContainer.insertBefore(alarmCol, parentContainer.lastElementChild);
    
    this.containerEl = document.getElementById('alarm-log-list');
    
    document.getElementById('btn-ack-all-alarms')?.addEventListener('click', () => {
      const state = this.store.getState();
      state.alarms.forEach(a => {
        a.payload.acknowledged = true;
      });
      // Limpar lista visual
      this.store.update({ alarms: [] });
    });
  }
  
  /** Subscreve no store */
  private subscribeToStore(): void {
    this.store.subscribe('alarm-log-panel', (_state, changedKeys) => {
      if (changedKeys.has('alarms')) {
        this.renderAlarms();
      }
    });
  }
  
  /**
   * Renderiza os alarmes ativos.
   */
  private renderAlarms(): void {
    if (!this.containerEl) return;
    
    const state = this.store.getState();
    const alarms = state.alarms.filter(a => !a.payload.acknowledged);
    
    if (alarms.length === 0) {
      this.containerEl.innerHTML = `<div style="font-size:0.7rem; color:var(--text-secondary); text-align:center; margin-top:20px;">Nenhum alarme operacional ativo.</div>`;
      return;
    }
    
    let html = '';
    // Mostrar os mais recentes primeiro
    for (let i = alarms.length - 1; i >= 0; i--) {
      const entry = alarms[i];
      const timeStr = new Date(entry.timestamp).toLocaleTimeString();
      
      let badgeColor = 'var(--color-red)';
      if (entry.payload.severity === 'warning') badgeColor = 'var(--color-amber)';
      if (entry.payload.severity === 'info') badgeColor = 'var(--color-blue)';
      
      html += `
        <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(239,68,68,0.1); border-left:3px solid ${badgeColor}; padding:5px; border-radius:4px; margin-bottom:2px;">
          <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
            <span style="font-size:0.6rem; color:var(--text-secondary);">${timeStr}</span>
            <span style="font-size:0.65rem; font-weight:600; color:var(--text-primary);">${entry.payload.message}</span>
          </div>
          <button class="btn-ack-single" data-index="${i}" style="font-size:0.6rem; background:rgba(255,255,255,0.1); border:none; color:var(--text-secondary); padding:2px 4px; border-radius:3px; cursor:pointer;">✗</button>
        </div>
      `;
    }
    
    this.containerEl.innerHTML = html;
    
    // Adicionar listeners para botões de reconhecimento individuais
    const buttons = this.containerEl.querySelectorAll('.btn-ack-single');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const index = parseInt(target.getAttribute('data-index')!);
        const activeAlarms = [...state.alarms];
        if (activeAlarms[index]) {
          activeAlarms[index].payload.acknowledged = true;
          // Remover do array ou disparar atualização
          const filtered = activeAlarms.filter((_, idx) => idx !== index);
          this.store.update({ alarms: filtered });
        }
      });
    });
  }
}
