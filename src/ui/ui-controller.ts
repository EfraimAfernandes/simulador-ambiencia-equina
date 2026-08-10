import { ControlVolume } from '../sim/state/control-volume.ts';
import { PhysicsParams } from '../sim/systems/physics-engine.ts';
import { DigitalTwinStore } from '../sim/state/global-state.ts';
import { IoTManager } from '../hal/iot-manager.ts';
import type { IoTControllerMode } from '../hal/iot-factory.ts';

export class UIController {
  private cv: ControlVolume;
  private iot: IoTManager;
  
  // Elementos HTML dos Controles
  public slideTExt = document.getElementById('slide-t-ext') as HTMLInputElement;
  public slideRHExt = document.getElementById('slide-rh-ext') as HTMLInputElement;
  public slideSolar = document.getElementById('slide-solar') as HTMLInputElement;
  public slideHorses = document.getElementById('slide-horses') as HTMLInputElement;
  public selectActivity = document.getElementById('select-activity') as HTMLSelectElement;
  public slideBedding = document.getElementById('slide-bedding') as HTMLInputElement;
  
  public toggleAutoControl = document.getElementById('toggle-auto-control') as HTMLInputElement;
  public slideFan = document.getElementById('slide-fan') as HTMLInputElement;
  public slideCurtain = document.getElementById('slide-curtain') as HTMLInputElement;
  
  public slideRoofU = document.getElementById('slide-roof-u') as HTMLInputElement;
  public slideShading = document.getElementById('slide-shading') as HTMLInputElement;
  public selectStructuralPreset = document.getElementById('select-structural-preset') as HTMLSelectElement;
  
  public slideTimeScale = document.getElementById('slide-time-scale') as HTMLInputElement;
  
  // Elementos HUD/Visualização
  public btnToggleParticles = document.getElementById('btn-toggle-particles') as HTMLButtonElement;
  public btnToggleHeatmap = document.getElementById('btn-toggle-heatmap') as HTMLButtonElement;
  public btnToggleCV = document.getElementById('btn-toggle-cv') as HTMLButtonElement;
  public btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
  public btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
  
  // Elementos do Dashboard
  private valComfortIdx = document.getElementById('val-comfort-idx')!;
  private valComfortStatus = document.getElementById('val-comfort-status')!;
  private valWelfareTip = document.getElementById('val-welfare-tip')!;
  
  private valQMet = document.getElementById('val-q-met')!;
  private valQSol = document.getElementById('val-q-sol')!;
  private valQCond = document.getElementById('val-q-cond')!;
  private valQVent = document.getElementById('val-q-vent')!;
  private valNetFlow = document.getElementById('val-net-flow')!;
  
  private barQMet = document.getElementById('bar-q-met')!;
  private barQSol = document.getElementById('bar-q-sol')!;
  private barQCond = document.getElementById('bar-q-cond')!;
  private barQVent = document.getElementById('bar-q-vent')!;
  
  // Serial / IoT
  private selectIoTMode = document.getElementById('select-iot-mode') as HTMLSelectElement;
  private btnConnectSerial = document.getElementById('btn-connect-serial') as HTMLButtonElement;
  private arduinoConsole = document.getElementById('arduino-console')!;
  private arduinoStatusLabel = document.getElementById('arduino-status-label')!;
  private arduinoStatusDot = document.getElementById('arduino-status-dot')!;
  private modeBadgeLabel = document.getElementById('mode-badge-label')!;
  
  constructor(cv: ControlVolume, _store: DigitalTwinStore, iot: IoTManager) {
    this.cv = cv;
    this.iot = iot;
    this.initTabs();
    this.initInputBindings();
    this.initSerial();
    this.initTogglePanels();
  }
  
  /**
   * Inicializa a navegação entre Abas Laterais
   */
  private initTabs(): void {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const formulaTabTitle = document.getElementById('formula-tab-title')!;
    const formulaMath = document.getElementById('formula-math')!;
    const formulaDesc = document.getElementById('formula-desc')!;
    
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab')!;
        const content = document.getElementById(tabId)!;
        content.classList.add('active');
        
        // Mudar fórmula didática de acordo com a aba selecionada
        switch (tabId) {
          case 'tab-physics':
            formulaTabTitle.textContent = 'Balanço de Energia Geral';
            formulaMath.textContent = 'dU_vc/dt = Q_solar + Q_met + Q_cond + Q_vent';
            formulaDesc.textContent = 'Balanço térmico no volume de controle. A variação de energia interna determina o aquecimento ou resfriamento do ar no galpão.';
            break;
            
          case 'tab-ventilation':
            formulaTabTitle.textContent = 'Balanço de Massa (Vapor d\'Água)';
            formulaMath.textContent = 'dM_vapor/dt = m_cama + m_animais - m_exaustão';
            formulaDesc.textContent = 'O acúmulo de umidade é controlado pela taxa de transpiração dos animais e evaporação da cama, compensados pela ventilação.';
            break;
            
          case 'tab-envelope':
            formulaTabTitle.textContent = 'Condução pelas Paredes e Teto';
            formulaMath.textContent = 'Q_cond = sum( U * A ) * (T_ext - T_int)';
            formulaDesc.textContent = 'A taxa de transferência de calor por condução depende da área superficial, da diferença de temperatura e do U-Value (isolamento) dos materiais.';
            break;
            
          case 'tab-arduino':
            formulaTabTitle.textContent = 'Ciclo de Histerese de Controle';
            formulaMath.textContent = 'T_int >= 28.0°C -> FAN ON\nT_int <= 25.0°C -> FAN OFF';
            formulaDesc.textContent = 'A histerese evita o desgaste elétrico dos relés, definindo faixas térmicas distintas para ativação e desativação do sistema de resfriamento.';
            break;
            
          case 'tab-debug':
            formulaTabTitle.textContent = 'Média Móvel Exponencial (EMA)';
            formulaMath.textContent = 'S_t = \alpha \cdot Y_t + (1 - \alpha) \cdot S_{t-1}';
            formulaDesc.textContent = 'Filtro de amortecimento de ruído. Suaviza variações espúrias dos sensores antes de alimentar a máquina de decisão da automação.';
            break;
        }
      });
    });
  }
  
  /**
   * Liga os inputs para atualizar as labels dinâmicas nos sliders
   */
  private initInputBindings(): void {
    const bindVal = (sliderId: string, labelId: string, unit = '') => {
      const slider = document.getElementById(sliderId) as HTMLInputElement;
      const label = document.getElementById(labelId)!;
      if (slider && label) {
        slider.addEventListener('input', () => {
          label.textContent = slider.value + unit;
        });
        label.textContent = slider.value + unit;
      }
    };
    
    bindVal('slide-t-ext', 'val-t-ext');
    bindVal('slide-rh-ext', 'val-rh-ext');
    bindVal('slide-solar', 'val-solar');
    bindVal('slide-horses', 'val-horses');
    bindVal('slide-bedding', 'val-bedding');
    bindVal('slide-fan', 'val-fan');
    bindVal('slide-curtain', 'val-curtain');
    bindVal('slide-roof-u', 'val-roof-u');
    bindVal('slide-shading', 'val-shading');
    bindVal('slide-time-scale', 'val-time-scale', 'x');
    
    // Desabilitar controle manual do exaustor quando estiver no modo Histerese Automático
    this.toggleAutoControl.addEventListener('change', () => {
      if (this.toggleAutoControl.checked) {
        this.slideFan.disabled = true;
        this.slideFan.style.opacity = '0.5';
      } else {
        this.slideFan.disabled = false;
        this.slideFan.style.opacity = '1.0';
      }
    });
  }
  
  /**
   * Conecta com o controlador IoT (mock ou serial hardware)
   */
  private initSerial(): void {
    this.iot.onLog(msg => this.logToConsole(msg));

    this.selectIoTMode?.addEventListener('change', () => {
      const mode = this.selectIoTMode.value as IoTControllerMode;
      this.iot.setMode(mode);
      this.updateConnectButtonLabel();
      if (this.iot.isConnected) {
        void this.iot.disconnect().then(() => this.disconnectSerialUI());
      }
    });

    this.btnConnectSerial.addEventListener('click', async () => {
      const mode = (this.selectIoTMode?.value ?? 'none') as IoTControllerMode;

      if (mode === 'none') {
        this.logToConsole('Selecione Mock ou Hardware antes de conectar.');
        return;
      }

      if (this.iot.isConnected) {
        await this.iot.disconnect();
        this.disconnectSerialUI();
      } else {
        try {
          this.iot.setMode(mode);
          await this.iot.connect();
          this.onConnectSuccess(mode);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logToConsole(`ERRO de conexão: ${msg}`);
          this.disconnectSerialUI();
        }
      }
    });
  }

  private onConnectSuccess(mode: IoTControllerMode): void {
    this.btnConnectSerial.textContent = 'DESCONECTAR CONTROLADOR';
    this.btnConnectSerial.classList.add('btn-secondary');

    if (mode === 'hardware') {
      this.arduinoStatusLabel.textContent = 'Arduino: Conectado';
      this.arduinoStatusDot.className = 'status-dot';
      this.modeBadgeLabel.textContent = 'IoT INTEGRADO';

      this.slideTExt.disabled = true;
      this.slideRHExt.disabled = true;
      this.slideTExt.style.opacity = '0.5';
      this.slideRHExt.style.opacity = '0.5';
    } else {
      this.arduinoStatusLabel.textContent = 'VirtualArduino: Ativo';
      this.arduinoStatusDot.className = 'status-dot';
      this.modeBadgeLabel.textContent = 'MOCK IoT';
    }

    this.toggleAutoControl.disabled = true;
    this.slideFan.disabled = true;
    this.toggleAutoControl.style.opacity = '0.5';
    this.slideFan.style.opacity = '0.5';
  }

  private updateConnectButtonLabel(): void {
    const mode = (this.selectIoTMode?.value ?? 'none') as IoTControllerMode;
    if (!this.iot.isConnected) {
      this.btnConnectSerial.textContent =
        mode === 'mock' ? 'ATIVAR VIRTUAL ARDUINO' : 'CONECTAR ARDUINO SERIAL';
    }
  }
  
  /**
   * Imprime mensagens de depuração no console visível da aba IoT
   */
  private logToConsole(msg: string): void {
    const time = new Date().toLocaleTimeString();
    const lineEl = document.createElement('div');
    lineEl.textContent = `[${time}] ${msg}`;
    this.arduinoConsole.appendChild(lineEl);
    this.arduinoConsole.scrollTop = this.arduinoConsole.scrollHeight;
  }
  
  /**
   * Atualiza a UI serial para o estado desconectado
   */
  private disconnectSerialUI(): void {
    this.arduinoStatusLabel.textContent = 'Arduino: Desconectado';
    this.arduinoStatusDot.className = 'status-dot offline';
    this.modeBadgeLabel.textContent = 'SIMULAÇÃO';
    this.updateConnectButtonLabel();
    this.btnConnectSerial.classList.remove('btn-secondary');
    
    this.slideTExt.disabled = false;
    this.slideRHExt.disabled = false;
    this.toggleAutoControl.disabled = false;
    
    this.slideTExt.style.opacity = '1.0';
    this.slideRHExt.style.opacity = '1.0';
    this.toggleAutoControl.style.opacity = '1.0';
    
    if (this.toggleAutoControl.checked) {
      this.slideFan.disabled = true;
      this.slideFan.style.opacity = '0.5';
    } else {
      this.slideFan.disabled = false;
      this.slideFan.style.opacity = '1.0';
    }
  }
  
  /**
   * Retorna os parâmetros atuais a serem passados para a física
   */
  public getPhysicsParams(): PhysicsParams {
    return {
      T_ext: parseFloat(this.slideTExt.value),
      RH_ext: parseFloat(this.slideRHExt.value),
      solarRadiation: parseFloat(this.slideSolar.value),
      numHorses: parseInt(this.slideHorses.value),
      horseActivity: this.selectActivity.value as 'resting' | 'eating' | 'sweating',
      fanFlowRate: this.toggleAutoControl.checked ? 0 : parseFloat(this.slideFan.value), // Se auto, a física da classe app tratará
      beddingWetness: parseFloat(this.slideBedding.value) / 100,
      curtainOpening: parseFloat(this.slideCurtain.value) / 100,
      timeScale: parseFloat(this.slideTimeScale.value),
      structuralPreset: this.selectStructuralPreset ? (this.selectStructuralPreset.value as 'traditional' | 'premium') : 'traditional'
    };
  }
  
  /**
   * Atualiza a interface gráfica do Dashboard a cada frame da simulação
   */
  public updateDashboard(_temp: number, _rh: number, indexVal: number, statusStr: string, textTip: string): void {
    // 1. Atualizar conforto
    this.valComfortIdx.textContent = indexVal.toFixed(0);
    this.valComfortStatus.textContent = statusStr;
    this.valWelfareTip.textContent = textTip;
    
    // Mudar cor do conforto
    if (statusStr.includes("Grave")) {
      this.valComfortIdx.className = "comfort-index-big";
      this.valComfortIdx.style.color = "var(--color-red)";
      this.valComfortStatus.style.color = "var(--color-red)";
    } else if (statusStr.includes("Alerta")) {
      this.valComfortIdx.className = "comfort-index-big";
      this.valComfortIdx.style.color = "var(--color-amber)";
      this.valComfortStatus.style.color = "var(--color-amber)";
    } else {
      this.valComfortIdx.className = "comfort-index-big";
      this.valComfortIdx.style.color = "var(--color-green)";
      this.valComfortStatus.style.color = "var(--color-green)";
    }
    
    // 2. Atualizar fluxos de calor
    const formatW = (val: number) => (val >= 0 ? '+' : '') + val.toFixed(0) + ' W';
    this.valQMet.textContent = formatW(this.cv.Q_metabolic);
    this.valQSol.textContent = formatW(this.cv.Q_solar);
    this.valQCond.textContent = formatW(this.cv.Q_conduction);
    this.valQVent.textContent = formatW(this.cv.Q_ventilation);
    
    // Atualizar larguras das barras gráficas (escala máxima calibrada em 5000 Watts para amplitude visual)
    const scale = 5000;
    const getPercent = (w: number) => Math.min(100, (Math.abs(w) / scale) * 100) + '%';
    
    (this.barQMet as HTMLElement).style.width = getPercent(this.cv.Q_metabolic);
    (this.barQSol as HTMLElement).style.width = getPercent(this.cv.Q_solar);
    (this.barQCond as HTMLElement).style.width = getPercent(this.cv.Q_conduction);
    (this.barQVent as HTMLElement).style.width = getPercent(this.cv.Q_ventilation);
    
    // dU/dt Líquido
    const netFlow = this.cv.Q_solar + this.cv.Q_metabolic + this.cv.Q_conduction + this.cv.Q_ventilation;
    const sign = netFlow >= 0 ? '+' : '';
    const stateText = netFlow >= 0 ? ' (Ganhando calor)' : ' (Esfriando galpão)';
    this.valNetFlow.textContent = `${sign}${netFlow.toFixed(0)} W${stateText}`;
    this.valNetFlow.style.color = netFlow >= 0 ? 'var(--color-red)' : 'var(--color-cyan)';
  }
  
  /**
   * Inicializa botões de recolhimento dos painéis para desobstruir a tela (Fase 5)
   */
  private initTogglePanels(): void {
    // 1. Ocultar/Exibir o Painel do Dashboard (Rodapé)
    const btnToggleDashboard = document.getElementById('btn-toggle-dashboard');
    const dashboardPanel = document.getElementById('dashboard-panel');
    const formulaPanel = document.getElementById('formula-display-panel');
    
    if (btnToggleDashboard && dashboardPanel) {
      btnToggleDashboard.addEventListener('click', () => {
        const isCollapsed = dashboardPanel.classList.toggle('collapsed');
        const icon = btnToggleDashboard.querySelector('.toggle-icon')!;
        const text = btnToggleDashboard.querySelector('.toggle-text')!;
        
        if (isCollapsed) {
          icon.textContent = '▲';
          text.textContent = 'Mostrar Painel';
          if (formulaPanel) formulaPanel.style.bottom = '20px';
        } else {
          icon.textContent = '▼';
          text.textContent = 'Ocultar Painel';
          if (formulaPanel) formulaPanel.style.bottom = '280px';
        }
      });
    }
    
    // 2. Ocultar/Exibir a Barra Lateral (aside)
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const sidebarPanel = document.querySelector('aside.glass-panel') as HTMLElement;
    
    if (btnToggleSidebar && sidebarPanel) {
      btnToggleSidebar.addEventListener('click', () => {
        const isCollapsed = sidebarPanel.classList.toggle('collapsed');
        btnToggleSidebar.textContent = isCollapsed ? '▶' : '◀';
        
        // Ajustar a largura do painel do rodapé para se alinhar com a tela limpa
        if (dashboardPanel) {
          if (isCollapsed) {
            dashboardPanel.style.left = '20px';
          } else {
            dashboardPanel.style.left = '420px';
          }
        }
      });
    }
    
    // 3. Fechar Painel de Fórmulas no Botão Close '✕'
    const btnCloseFormula = document.getElementById('btn-close-formula');
    if (btnCloseFormula && formulaPanel) {
      btnCloseFormula.addEventListener('click', () => {
        formulaPanel.style.display = 'none';
        const btnToggleFormulaHud = document.getElementById('btn-toggle-formula-hud');
        if (btnToggleFormulaHud) btnToggleFormulaHud.classList.remove('active');
      });
    }
    
    // 4. Alternar Painel de Fórmulas no HUD Overlay superior
    const btnToggleFormulaHud = document.getElementById('btn-toggle-formula-hud');
    if (btnToggleFormulaHud && formulaPanel) {
      btnToggleFormulaHud.addEventListener('click', () => {
        const isActive = btnToggleFormulaHud.classList.toggle('active');
        formulaPanel.style.display = isActive ? 'block' : 'none';
      });
    }
  }
}
