// ─────────────────────────────────────────────────────────────
// SIMULADOR DE AMBIÊNCIA EQUINA — UFR/ICAT
// Curso de Engenharia Agrícola e Ambiental
// Autores: Efraim Almeida Fernandes · Hallison Bittencourt Santos · Geovana Bertoldo de Souza Alves
// Orientador: Prof. Jofran Luiz de Oliveira
// ─────────────────────────────────────────────────────────────

/**
 * app.ts
 * 
 * Orquestrador principal do Gêmeo Digital Equino.
 * 
 * Responsabilidades:
 * 1. Instanciar e conectar os quatro núcleos (físico, zootécnico, automação, visual)
 * 2. Manter o ciclo completo: ambiente → sensoriamento → decisão → atuação → efeito → visualização → histórico
 * 3. Separar sim loop (passo fixo) de render loop (requestAnimationFrame)
 * 4. Propagar estado do store reativo para todos os subsistemas
 * 
 * A automação NÃO vive mais inline neste arquivo — está extraída para
 * os módulos de automação (fan-controller, control-rules).
 */

import * as THREE from 'three';
import { SceneManager } from './render/scene-manager.ts';
import { BarnGeometry } from './render/facility/barn-geometry.ts';
import { HorseRenderer } from './render/horses/horse-renderer.ts';
import { AirflowParticleSystem } from './render/overlays/particle-system.ts';
import { HeatmapRenderer } from './render/overlays/heatmap-renderer.ts';
import { FanRenderer } from './render/objects/fans.ts';
import { AirflowOverlay } from './render/effects/airflow-overlay.ts';
import { ThermalSurfaceOverlay } from './render/effects/thermal-surface-overlay.ts';
import { ControlVolume } from './sim/state/control-volume.ts';
import { DigitalTwinStore } from './sim/state/global-state.ts';
import { PhysicsEngine } from './sim/systems/physics-engine.ts';
import { UIController } from './ui/ui-controller.ts';
import { CanvasChart } from './ui/charts/chart-manager.ts';
import { getEquineComfortIndex } from './domain/climate/psychrometrics.ts';
import { FanController } from './automation/fan-controller.ts';
import { IoTManager } from './hal/iot-manager.ts';
import { ControlRules } from './automation/control-rules.ts';
import { AutomationPanel } from './ui/panels/automation-panel.ts';
import { SensorHealthPanel } from './ui/panels/sensor-health-panel.ts';
import { FanStatusPanel } from './ui/panels/fan-status-panel.ts';
import { CommandLog } from './analytics/command-log.ts';
import { AlarmLog } from './analytics/alarm-log.ts';
import type { ControlMode, CommandLogEntry } from './iot/message-schema.ts';

class App {
  // ─── Núcleo Visual ─────────────────────────────────────────────────
  private sceneManager: SceneManager;
  private barnGeo: BarnGeometry;
  private horseRenderer: HorseRenderer;
  private particleSystem: AirflowParticleSystem;
  private heatmapRenderer: HeatmapRenderer;
  private fanRenderer: FanRenderer;
  private airflowOverlay: AirflowOverlay;
  private thermalSurfaceOverlay: ThermalSurfaceOverlay;
  
  // ─── Núcleo Físico ─────────────────────────────────────────────────
  private cv: ControlVolume;
  private fanControllers: FanController[];
  private iotManager: IoTManager;
  
  // ─── Store Reativo ─────────────────────────────────────────────────
  private store: DigitalTwinStore;
  
  // ─── UI ────────────────────────────────────────────────────────────
  private ui: UIController;
  private tempChart: CanvasChart;
  private rhChart: CanvasChart;
  private sensorDebugTempChart!: CanvasChart;
  private sensorDebugRHChart!: CanvasChart;
  
  // Histórico de séries temporais para exportação CSV (Fase 4)
  private csvData: Array<{
    timestamp: number;
    tReal: number;
    tMeasured: number;
    tFiltered: number;
    rhReal: number;
    rhMeasured: number;
    rhFiltered: number;
    fansPower: number;
    fanState: string;
  }> = [];
  
  // ─── Relógio ───────────────────────────────────────────────────────
  private clock: THREE.Clock;
  private lastChartUpdateTime = 0;
  

  
  // ─── Controlador IoT (mock ou hardware) ───────────────────────────
  private isControllerOverride = false;
  private legacyArduinoFanState = false;
  
  constructor() {
    this.clock = new THREE.Clock();
    
    // 1. Instanciar Store Reativo central
    this.store = new DigitalTwinStore();
    
    // 2. Inicializar o Estado Físico (Volume de Controle)
    this.cv = new ControlVolume({
      length: 12,
      width: 8,
      height: 4.5,
      roofUValue: 1.5,
      wallUValue: 2.0,
      shadingFactor: 0
    }, 24.0, 60.0);
    
    // Instanciar gerenciador IoT (HAL)
    this.iotManager = new IoTManager();
    
    // 3. Inicializar a Interface do Usuário (Sliders, Abas)
    this.ui = new UIController(this.cv, this.store, this.iotManager);
    
    // Instanciar painéis diagnósticos e analíticos (Fase 3 & 4)
    new AutomationPanel(this.store);
    new SensorHealthPanel(this.store);
    new FanStatusPanel(this.store);
    new CommandLog(this.store);
    new AlarmLog(this.store);
    
    // 4. Inicializar os Gráficos de Linha do Dashboard
    this.tempChart = new CanvasChart('chart-temp', {
      maxDataPoints: 50,
      labelY: '°C',
      minVal: 10,
      maxVal: 45,
      color1: '#ef4444', // Vermelho (Interna)
      color2: '#38bdf8'  // Azul (Externa)
    });
    
    this.rhChart = new CanvasChart('chart-rh', {
      maxDataPoints: 50,
      labelY: '%',
      minVal: 10,
      maxVal: 100,
      color1: '#eab308', // Amarelo (Interna)
      color2: '#06b6d4'  // Cyan (Externa)
    });

    // Inicializar os Gráficos de Debug do Sensor/Filtro (Fase 4)
    this.sensorDebugTempChart = new CanvasChart('chart-sensor-debug-temp', {
      maxDataPoints: 50,
      labelY: '°C',
      minVal: 15,
      maxVal: 40,
      color1: '#ef4444', // Vermelho (Real)
      color2: '#f1f5f9', // Branco (Medido)
      color3: '#38bdf8'  // Azul (Filtrado)
    });
    
    this.sensorDebugRHChart = new CanvasChart('chart-sensor-debug-rh', {
      maxDataPoints: 50,
      labelY: '%',
      minVal: 20,
      maxVal: 100,
      color1: '#ef4444', // Vermelho (Real)
      color2: '#f1f5f9', // Branco (Medido)
      color3: '#38bdf8'  // Azul (Filtrado)
    });
    
    // 5. Inicializar o Motor de Renderização Three.js
    this.sceneManager = new SceneManager('canvas-container');
    
    // 6. Instanciar Componentes 3D na Cena
    this.barnGeo = new BarnGeometry(this.cv);
    this.sceneManager.scene.add(this.barnGeo.group);
    
    // Sincronização inicial e listener para o preset construtivo estrutural
    if (this.ui.selectStructuralPreset) {
      const syncPreset = () => {
        const pr = this.ui.selectStructuralPreset.value as 'traditional' | 'premium';
        this.cv.structuralPreset = pr;
        this.barnGeo.setStructuralPreset(pr);
      };
      this.ui.selectStructuralPreset.addEventListener('change', syncPreset);
      syncPreset();
    }
    
    this.horseRenderer = new HorseRenderer();
    this.sceneManager.scene.add(this.horseRenderer.group);
    
    this.particleSystem = new AirflowParticleSystem(
      this.cv.config.length,
      this.cv.config.width,
      this.cv.config.height
    );
    this.sceneManager.scene.add(this.particleSystem.points);
    
    this.heatmapRenderer = new HeatmapRenderer(this.cv);
    this.sceneManager.scene.add(this.heatmapRenderer.mesh);
    
    // Instanciar novos atuadores e overlays científicos
    this.fanControllers = [
      new FanController('fan-exhaust-01'),
      new FanController('fan-exhaust-02')
    ];
    
    this.fanRenderer = new FanRenderer([
      { id: 'fan-exhaust-01', position: new THREE.Vector3(-3, 3.15, -3.99), direction: new THREE.Vector3(0, 0, -1), radius: 0.6 },
      { id: 'fan-exhaust-02', position: new THREE.Vector3(3, 3.15, -3.99), direction: new THREE.Vector3(0, 0, -1), radius: 0.6 }
    ]);
    this.sceneManager.scene.add(this.fanRenderer.group);
    
    this.airflowOverlay = new AirflowOverlay(
      this.cv.config.length,
      this.cv.config.width,
      this.cv.config.height
    );
    this.sceneManager.scene.add(this.airflowOverlay.group);
    
    this.thermalSurfaceOverlay = new ThermalSurfaceOverlay(
      this.cv.config.length,
      this.cv.config.width,
      this.cv.config.height
    );
    this.sceneManager.scene.add(this.thermalSurfaceOverlay.group);
    
    // 7. Posicionar os cavalos
    this.updateHorseCount();
    
    // 8. Configurar Botões HUD e Eventos
    this.bindHUDButtons();
    this.bindSerialEvents();
    this.bindScenarioPresets();
    
    // 9. Sincronizar store inicial com CV
    this.syncCVToStore();
    
    // 10. Iniciar Loop de Animação
    this.animate();
  }
  
  /**
   * Reseta/Reinstancia o número de cavalos baseado no slider
   */
  private updateHorseCount(): void {
    const params = this.ui.getPhysicsParams();
    this.horseRenderer.setupHorses(params.numHorses, this.cv.config.length, this.cv.config.width);
  }
  
  /**
   * Liga os botões de sobreposição visual (Particles, Heatmap, Play, Reset)
   */
  private bindHUDButtons(): void {
    // Alternar Partículas e Fluxo de Ar
    this.ui.btnToggleParticles.addEventListener('click', () => {
      const active = this.ui.btnToggleParticles.classList.toggle('active');
      this.particleSystem.setVisible(active);
      this.airflowOverlay.setVisible(active);
    });
    
    // Alternar Heatmap e Temperatura de Superfície
    this.ui.btnToggleHeatmap.addEventListener('click', () => {
      const active = this.ui.btnToggleHeatmap.classList.toggle('active');
      this.heatmapRenderer.setVisible(active);
      this.thermalSurfaceOverlay.setVisible(active);
    });
    
    // Alternar Outline do Volume de Controle
    this.ui.btnToggleCV.addEventListener('click', () => {
      const active = this.ui.btnToggleCV.classList.toggle('active');
      const outline = this.barnGeo.group.children[0];
      if (outline) outline.visible = active;
    });
    
    // Play/Pause
    this.ui.btnPlayPause.addEventListener('click', () => {
      const state = this.store.getState();
      this.store.update({ isPaused: !state.isPaused });
      const isPaused = this.store.getState().isPaused;
      this.ui.btnPlayPause.textContent = isPaused ? '▶' : '⏸';
      this.ui.btnPlayPause.classList.toggle('active', isPaused);
    });
    
    // Resetar Simulação
    this.ui.btnReset.addEventListener('click', () => {
      const params = this.ui.getPhysicsParams();
      this.cv.reset(params.T_ext, params.RH_ext);
      this.store.reset();
      
      // Resetar controladores de ventiladores
      this.fanControllers.forEach(fc => fc.reset());
      
      this.tempChart.clear();
      this.rhChart.clear();
      this.store.update({ isPaused: false });
      this.ui.btnPlayPause.textContent = '⏸';
      this.ui.btnPlayPause.classList.remove('active');
    });
    
    // Monitorar mudanças no número de cavalos para remontar as malhas
    this.ui.slideHorses.addEventListener('change', () => this.updateHorseCount());
  }
  
  private bindSerialEvents(): void {
    // 1. Comandos canônicos do controlador (mock ou firmware compacto)
    this.iotManager.onCommandReceived(() => {
      this.isControllerOverride = true;
      this.store.update({
        arduinoConnectionStatus: 'connected',
        lastArduinoHeartbeat: Date.now(),
        controlMode: 'arduino' as ControlMode,
      });
    });

    // 2. Mensagens legadas do firmware antigo (português / heartbeat)
    this.iotManager.onLegacyMessage(msg => {
      const state = this.store.getState();
      
      if (msg.type === 'heartbeat') {
        this.store.update({
          arduinoConnectionStatus: 'connected',
          lastArduinoHeartbeat: Date.now()
        });
        
        this.store.update({
          sensorHealth: {
            'dht11-temp': {
              sensorId: 'dht11-temp',
              status: 'ok',
              lastValue: this.cv.T_measured,
              lastUpdateTimestamp: Date.now(),
              readingsCount: (state.sensorHealth['dht11-temp']?.readingsCount || 0) + 1,
              faultCount: state.sensorHealth['dht11-temp']?.faultCount || 0,
              deviation: 0
            },
            'dht11-rh': {
              sensorId: 'dht11-rh',
              status: 'ok',
              lastValue: this.cv.RH_measured,
              lastUpdateTimestamp: Date.now(),
              readingsCount: (state.sensorHealth['dht11-rh']?.readingsCount || 0) + 1,
              faultCount: state.sensorHealth['dht11-rh']?.faultCount || 0,
              deviation: 0
            }
          }
        });
        
      } else if (msg.type === 'fan_state') {
        this.legacyArduinoFanState = msg.payload.isOn;
        
      } else if (msg.type === 'connection_lost') {
        this.isControllerOverride = false;
        this.store.update({
          arduinoConnectionStatus: 'disconnected'
        });
      }
    });

    // 3. Evento legado do firmware antigo (telemetria em português)
    window.addEventListener('arduinoData', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { temp, rh, fanOn } = customEvent.detail;
      
      this.legacyArduinoFanState = fanOn;
      
      // O Arduino dita as condições externas
      this.ui.slideTExt.value = temp.toString();
      this.ui.slideRHExt.value = rh.toString();
      
      // Atualizar store com status do Arduino
      this.store.update({
        arduinoConnectionStatus: 'connected',
        lastArduinoHeartbeat: Date.now(),
        controlMode: 'arduino' as ControlMode,
      });
      
      // Registrar heartbeat no log de telemetria
      this.store.addTelemetryEvent({
        timestamp: Date.now(),
        eventType: 'arduino_data',
        data: { temp, rh, fanOn },
      });
    });

    // 3. Ouvir injeção de falhas vinda do FanStatusPanel (Fase 4)
    window.addEventListener('toggleFanFault', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { fanId } = customEvent.detail;
      const fan = this.fanControllers.find(fc => fc.id === fanId);
      if (fan) {
        const isCurrentlyFault = fan.getState().state === 'fault';
        if (isCurrentlyFault) {
          fan.clearFault();
          this.store.addAlarm({
            type: 'alarm',
            timestamp: Date.now(),
            payload: {
              alarmType: 'actuator_fault',
              severity: 'info',
              message: `Exaustor ${fanId === 'fan-exhaust-01' ? '1' : '2'} recuperado com sucesso.`,
              value: 0,
              threshold: 0,
              acknowledged: true
            }
          });
        } else {
          fan.setFault();
          this.store.addAlarm({
            type: 'alarm',
            timestamp: Date.now(),
            payload: {
              alarmType: 'actuator_fault',
              severity: 'critical',
              message: `FALHA CRÍTICA: Exaustor ${fanId === 'fan-exhaust-01' ? '1' : '2'} reportou travamento mecânico!`,
              value: 1,
              threshold: 0,
              acknowledged: false
            }
          });
        }
      }
    });

    // 4. Botão de Exportar CSV (Fase 4)
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      this.exportTelemetryCSV();
    });
  }
  
  /**
   * Conecta os botões de Presets de Cenário para carregar configurações de simulação pré-definidas (Fase 4)
   */
  private bindScenarioPresets(): void {
    const traditionalBtn = document.getElementById('btn-preset-traditional');
    const idealBtn = document.getElementById('btn-preset-ideal');
    const criticalBtn = document.getElementById('btn-preset-critical');

    const loadPreset = (config: {
      tExt: number,
      rhExt: number,
      solar: number,
      horses: number,
      bedding: number,
      shading: number,
      roofU: number
    }) => {
      // 1. Atualizar Sliders de Clima e Animais
      this.ui.slideTExt.value = config.tExt.toString();
      this.ui.slideRHExt.value = config.rhExt.toString();
      this.ui.slideSolar.value = config.solar.toString();
      this.ui.slideHorses.value = config.horses.toString();
      this.ui.slideBedding.value = config.bedding.toString();
      this.ui.slideShading.value = config.shading.toString();
      this.ui.slideRoofU.value = config.roofU.toString();

      // 2. Disparar eventos para atualizar labels e acoplamentos
      this.ui.slideTExt.dispatchEvent(new Event('input'));
      this.ui.slideRHExt.dispatchEvent(new Event('input'));
      this.ui.slideSolar.dispatchEvent(new Event('input'));
      this.ui.slideHorses.dispatchEvent(new Event('input'));
      this.ui.slideHorses.dispatchEvent(new Event('change')); // recria cavalos
      this.ui.slideBedding.dispatchEvent(new Event('input'));
      this.ui.slideShading.dispatchEvent(new Event('input'));
      this.ui.slideRoofU.dispatchEvent(new Event('input'));

      // 3. Atualizar o Volume de Controle — reinicia próximo ao ar externo para comparação justa
      this.cv.config.roofUValue = config.roofU;
      this.cv.config.shadingFactor = config.shading / 100;
      this.cv.reset(config.tExt, config.rhExt);
      this.cv.T_envelope = config.tExt;
      
      // Sincronizar o dropdown do preset estrutural
      const structPreset = config.roofU > 1.2 ? 'traditional' : 'premium';
      if (this.ui.selectStructuralPreset) {
        this.ui.selectStructuralPreset.value = structPreset;
        this.ui.selectStructuralPreset.dispatchEvent(new Event('change'));
      }
      
      // Resetar horas fora de conforto para comparação justa
      this.cv.hoursOutOfComfort = 0;
      this.store.update({ totalHoursOutOfComfort: 0 });

      // Adicionar mensagem no console e log de alarmes
      this.store.addAlarm({
        type: 'alarm',
        timestamp: Date.now(),
        payload: {
          alarmType: 'energy_threshold',
          severity: 'info',
          message: `CENÁRIO CARREGADO: ${config.roofU > 2 ? 'Estábulo Tradicional' : config.tExt > 35 ? 'Onda de Calor Crítica' : 'Ambiência Premium'}`,
          value: 0,
          threshold: 0,
          acknowledged: true
        }
      });
    };

    traditionalBtn?.addEventListener('click', () => {
      loadPreset({
        tExt: 33.0,
        rhExt: 70,
        solar: 800,
        horses: 4,
        bedding: 80,
        shading: 0,
        roofU: 3.5
      });
    });

    idealBtn?.addEventListener('click', () => {
      loadPreset({
        tExt: 26.0,
        rhExt: 50,
        solar: 250,
        horses: 2,
        bedding: 20,
        shading: 90,
        roofU: 0.45
      });
    });

    criticalBtn?.addEventListener('click', () => {
      loadPreset({
        tExt: 39.0,
        rhExt: 75,
        solar: 950,
        horses: 4,
        bedding: 60,
        shading: 10,
        roofU: 2.0
      });
    });
  }
  
  /**
   * Sincroniza os valores do ControlVolume para o store reativo.
   * Chamado após cada tick de simulação.
   */
  private syncCVToStore(): void {
    const comfort = getEquineComfortIndex(this.cv.T_int, this.cv.RH_int);
    
    this.store.beginBatch();
    this.store.update({
      trueValues: {
        temperature: this.cv.T_int,
        humidity: this.cv.RH_int,
        airSpeed: this.cv.airSpeed,
      },
      measuredValues: {
        temperature: this.cv.T_measured,
        humidity: this.cv.RH_measured,
        airSpeed: this.cv.airSpeed_measured,
      },
      filteredValues: {
        temperature: this.cv.T_filtered,
        humidity: this.cv.RH_filtered,
        airSpeed: this.cv.airSpeed_filtered,
      },
      displayValues: {
        temperature: Math.round(this.cv.T_filtered * 10) / 10,
        humidity: Math.round(this.cv.RH_filtered),
        airSpeed: Math.round(this.cv.airSpeed_filtered * 100) / 100,
      },
      ventilationRate: this.cv.ventilationRate,
      airSpeed: this.cv.airSpeed,
      energyConsumptionActuators: this.cv.energyConsumed,
      totalEnergyConsumed: this.cv.energyConsumed,
      comfortIndex: comfort.index,
      comfortLabel: comfort.label,
      totalHoursOutOfComfort: this.cv.hoursOutOfComfort,
    });
    this.store.endBatch();
  }
  
  /**
   * Executa a lógica de decisão de automação.
   * Determina se o ventilador deve ligar/desligar baseado no modo de controle.
   * 
   * NOTA: Em Fase 3, esta lógica será movida para control-rules.ts
   */
  /**
   * Executa a lógica de decisão de automação.
   * Determina se o ventilador deve ligar/desligar baseado no modo de controle.
   */
  private runAutomationDecision(params: ReturnType<UIController['getPhysicsParams']>): number {
    let targetOn = false;
    let controlMode: ControlMode = 'manual';
    
    if (this.isControllerOverride && this.iotManager.isConnected) {
      controlMode = 'arduino';
      const { fan1, fan2 } = this.iotManager.actuatorState;
      targetOn = fan1 || fan2;
    } else if (this.iotManager.isConnected && this.iotManager.currentMode === 'hardware') {
      controlMode = 'arduino';
      targetOn = this.legacyArduinoFanState;
    } else if (this.ui.toggleAutoControl.checked) {
      controlMode = 'auto';
      const state = this.store.getState();
      const wasOn = this.fanControllers[0].getState().state !== 'off' && this.fanControllers[0].getState().state !== 'stopping';
      
      // Avaliar regras de controle estruturadas
      const evalResult = ControlRules.evaluate(
        this.cv.T_filtered,
        this.cv.RH_filtered,
        wasOn,
        state.setpoints,
        state.hysteresisBands
      );
      
      targetOn = evalResult.fanTargetOn;
      
      // Registrar ações e alarmes disparados no store
      evalResult.actions.forEach(act => {
        if (act.includes('ALERTA SANITÁRIO')) {
          const recentAlarm = state.alarms.find(
            a => a.payload.alarmType === 'high_humidity' &&
            (Date.now() - a.timestamp) < 60000
          );
          if (!recentAlarm) {
            this.store.addAlarm({
              type: 'alarm',
              timestamp: Date.now(),
              payload: {
                alarmType: 'high_humidity',
                severity: 'warning',
                message: act,
                value: this.cv.RH_filtered,
                threshold: state.setpoints.humidityHigh,
                acknowledged: false
              }
            });
          }
        }
      });
      
      // Sincronizar abertura sugerida das cortinas
      if (evalResult.suggestedCurtainOpening && evalResult.curtainOpeningValue !== undefined) {
        const valPercent = Math.round(evalResult.curtainOpeningValue * 100);
        this.ui.slideCurtain.value = valPercent.toString();
        const labelCurtain = document.getElementById('val-curtain');
        if (labelCurtain) labelCurtain.textContent = valPercent.toString();
        params.curtainOpening = evalResult.curtainOpeningValue;
      }
    } else {
      controlMode = 'manual';
      targetOn = params.fanFlowRate > 0;
    }
    
    // Atualizar comandos nos controladores
    this.fanControllers.forEach(fc => {
      const wasOn = fc.getState().state !== 'off' && fc.getState().state !== 'stopping';
      if (targetOn && !wasOn) {
        fc.turnOn();
        this.logFanCommand(controlMode, false, true, fc.id);
      } else if (!targetOn && wasOn) {
        fc.turnOff();
        this.logFanCommand(controlMode, true, false, fc.id);
      }
    });
    
    this.store.update({ controlMode });
    
    // Se controle for manual, o alvo nominal total vem do slider, caso contrário, 6000 m³/h nominal
    return targetOn ? (controlMode === 'manual' ? params.fanFlowRate : 6000) : 0;
  }
  
  /**
   * Aplica a dinâmica de resposta gradual de todos os ventiladores.
   * Acumula o consumo de energia e sincroniza os estados individuais com o store.
   * 
   * @param dt Delta time real em segundos
   * @returns Fração de fluxo médio efetivo (0.0 a 1.0)
   */
  private updateFanDynamics(dt: number): number {
    let totalFlow = 0;
    let totalPower = 0;
    
    this.fanControllers.forEach(fc => {
      fc.update(dt);
      const fs = fc.getState();
      totalFlow += fs.currentFlowRate;
      totalPower += fs.powerConsumption;
    });
    
    // Atualizar ControlVolume
    this.cv.fanRPM = this.fanControllers[0].rpm;
    this.cv.fanState = this.fanControllers[0].actuatorState;
    this.cv.fanFlowRate = totalFlow;
    this.cv.actuatorPower = totalPower;
    this.cv.accumulateEnergy(totalPower, dt);
    
    // Sincronizar estados dos atuadores de volta para o store
    this.store.update({
      fanStates: this.fanControllers.map(fc => ({ ...fc.getState() }))
    });
    
    return this.fanControllers[0].efficiency;
  }
  
  /**
   * Registra um comando de ventilador no log
   */
  private logFanCommand(mode: ControlMode, wasFanOn: boolean, isFanOn: boolean, fanId: string): void {
    const entry: CommandLogEntry = {
      timestamp: Date.now(),
      source: mode,
      target: fanId,
      action: isFanOn ? 'LIGAR' : 'DESLIGAR',
      previousState: wasFanOn ? 'running' : 'off',
      newState: isFanOn ? 'starting' : 'stopping',
    };
    this.store.logCommand(entry);
  }
  
  /**
   * Verifica condições de alarme e emite se necessário
   */
  private checkAlarms(): void {
    const state = this.store.getState();
    const comfort = getEquineComfortIndex(this.cv.T_int, this.cv.RH_int);
    
    // Alarme de estresse térmico grave
    if (comfort.status === 'DANGER') {
      // Só emitir se não houver um alarme igual ativo recente (debounce de 60s)
      const recentAlarm = state.alarms.find(
        a => a.payload.alarmType === 'comfort_danger' &&
        (Date.now() - a.timestamp) < 60000
      );
      
      if (!recentAlarm) {
        this.store.addAlarm({
          type: 'alarm',
          timestamp: Date.now(),
          payload: {
            alarmType: 'comfort_danger',
            severity: 'critical',
            message: `ESTRESSE TÉRMICO GRAVE! Índice equino: ${comfort.index.toFixed(0)}`,
            value: comfort.index,
            threshold: state.setpoints.comfortIndexDanger,
            acknowledged: false,
          },
        });
      }
    }
    
    // Verificar timeout de heartbeat do Arduino (se conectado)
    if (state.arduinoConnectionStatus === 'connected') {
      const timeSinceHeartbeat = Date.now() - state.lastArduinoHeartbeat;
      if (timeSinceHeartbeat > 10000) { // 10 segundos sem heartbeat
        this.store.update({ arduinoConnectionStatus: 'timeout' });
        this.store.addAlarm({
          type: 'alarm',
          timestamp: Date.now(),
          payload: {
            alarmType: 'connection_lost',
            severity: 'warning',
            message: `Arduino sem resposta há ${(timeSinceHeartbeat / 1000).toFixed(0)}s`,
            acknowledged: false,
          },
        });
        
        // Fallback: desativar override do controlador
        this.isControllerOverride = false;
        this.store.update({ controlMode: 'auto' });
      }
    }
  }
  
  /**
   * Loop principal requestAnimationFrame
   * 
   * Ciclo completo do gêmeo digital por frame:
   * 1. Ler entradas (UI + Arduino)
   * 2. Executar decisão de automação
   * 3. Aplicar dinâmica de atuadores
   * 4. Executar simulação física
   * 5. Aplicar ruído de sensor e filtro
   * 6. Verificar alarmes
   * 7. Sincronizar store
   * 8. Atualizar visualização
   * 9. Registrar telemetria
   */
  /**
   * Exporta a série temporal de telemetria acumulada no formato CSV
   */
  private exportTelemetryCSV(): void {
    if (this.csvData.length === 0) {
      alert('Nenhum dado de histórico acumulado ainda para exportação.');
      return;
    }
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,T_Real_C,T_Medido_C,T_Filtrado_C,RH_Real_Percent,RH_Medido_Percent,RH_Filtrado_Percent,Potencia_Atuadores_W,Estado_Ventiladores\n';
    
    this.csvData.forEach(row => {
      const isoTime = new Date(row.timestamp).toISOString();
      const line = `${isoTime},${row.tReal.toFixed(2)},${row.tMeasured.toFixed(2)},${row.tFiltered.toFixed(2)},${row.rhReal.toFixed(1)},${row.rhMeasured.toFixed(1)},${row.rhFiltered.toFixed(1)},${row.fansPower.toFixed(1)},${row.fanState}`;
      csvContent += line + '\n';
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetria_equino_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    
    const dt = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    const params = this.ui.getPhysicsParams();
    const state = this.store.getState();
    
    // Atualizar iluminação solar dinâmica
    this.sceneManager.updateSun(params.solarRadiation);
    
    if (!state.isPaused) {
      const dtSim = dt * params.timeScale;
      
      // ─── PASSO 1: Decisão de Automação ───────────────────────────
      const activeFanFlow = this.runAutomationDecision(params);
      
      // ─── PASSO 2: Dinâmica do Ventilador (resposta gradual) ──────
      const fanEfficiency = this.updateFanDynamics(dt);
      
      // A vazão efetiva é a vazão nominal × progresso da rampa
      const effectiveFanFlow = activeFanFlow * fanEfficiency;
      params.fanFlowRate = effectiveFanFlow;
      
      // Atualizar vazão no CV
      this.cv.fanFlowRate = effectiveFanFlow;
      
      // ─── PASSO 3: Simulação Física ───────────────────────────────
      PhysicsEngine.update(this.cv, dt, params);
      
      // cv.ventilationRate e cv.airSpeed são definidos pelo PhysicsEngine
      
      // ─── PASSO 4: Sensoriamento (ruído + filtro) ─────────────────
      this.cv.updateMeasuredValues();
      this.cv.updateFilteredValues();
      
      // ─── PASSO 4b: Enviar telemetria ao controlador IoT ──────────
      const ctrlMode = this.ui.toggleAutoControl.checked ? 'AUTO' : 'MANUAL';
      this.iotManager.tick(
        this.cv,
        params.T_ext,
        params.RH_ext,
        params.solarRadiation,
        state.setpoints,
        ctrlMode
      );
      
      // ─── PASSO 5: Métricas acumuladas ────────────────────────────
      const comfort = getEquineComfortIndex(this.cv.T_int, this.cv.RH_int);
      const isOutOfComfort = comfort.status !== 'COGNITIVE';
      this.cv.updateAccumulatedMetrics(dtSim, isOutOfComfort);
      
      // ─── PASSO 6: Alarmes ────────────────────────────────────────
      this.checkAlarms();
      
      // ─── PASSO 7: Sincronizar Store ──────────────────────────────
      this.syncCVToStore();
      
      // ─── PASSO 8: Gráficos e Histórico (Fase 4) ──────────────────
      const currentTime = performance.now();
      if (currentTime - this.lastChartUpdateTime > 600) {
        this.tempChart.addData(this.cv.T_filtered, params.T_ext);
        this.rhChart.addData(this.cv.RH_filtered, params.RH_ext);
        
        // Gráficos comparativos Real vs Medido vs Filtrado
        this.sensorDebugTempChart.addData(this.cv.T_int, this.cv.T_measured, this.cv.T_filtered);
        this.sensorDebugRHChart.addData(this.cv.RH_int, this.cv.RH_measured, this.cv.RH_filtered);
        
        // Acumular série temporal para exportação CSV
        this.csvData.push({
          timestamp: Date.now(),
          tReal: this.cv.T_int,
          tMeasured: this.cv.T_measured,
          tFiltered: this.cv.T_filtered,
          rhReal: this.cv.RH_int,
          rhMeasured: this.cv.RH_measured,
          rhFiltered: this.cv.RH_filtered,
          fansPower: this.cv.actuatorPower,
          fanState: this.cv.fanState
        });
        
        if (this.csvData.length > 1000) {
          this.csvData.shift();
        }
        
        this.lastChartUpdateTime = currentTime;
      }
    }
    
    // ─── PASSO 9: Atualizar Visualização ─────────────────────────────
    const fanEfficiency = this.fanControllers[0].efficiency;
    
    // Atualizar cortinas
    this.barnGeo.update(parseFloat(this.ui.slideCurtain.value) / 100, dt);
    
    // Atualizar ventiladores 3D
    const fanVisualStates = new Map();
    this.fanControllers.forEach(fc => {
      const fs = fc.getState();
      fanVisualStates.set(fc.id, {
        rpm: fs.rpm,
        state: fs.state,
        power: fs.powerConsumption,
        flowRate: fs.currentFlowRate
      });
    });
    this.fanRenderer.updateAll(fanVisualStates, dt);
    
    // Cavalos: usar valores filtrados para suavidade visual
    this.horseRenderer.update(this.cv.T_filtered, this.cv.RH_filtered, elapsedTime);
    
    // Partículas de ar — acopladas ao modelo físico de ventilação
    const horseWorldPositions = this.horseRenderer.horses.map(h => h.position);
    this.particleSystem.update(
      dt,
      this.cv.T_int,
      params.T_ext,
      params.curtainOpening,
      horseWorldPositions,
      this.cv.structuralPreset,
      this.cv.airSpeed,
      fanEfficiency,
      this.cv.Q_metabolic,
      this.cv.ventFlowMechanical,
      this.cv.ventFlowStack,
      this.cv.ventFlowCurtain,
      this.cv.ventFlowTotal
    );
    
    // Vetores de fluxo de ar (Setas 3D)
    this.airflowOverlay.update(
      fanEfficiency,
      parseFloat(this.ui.slideCurtain.value) / 100,
      this.cv.T_int,
      params.T_ext,
      this.cv.airSpeed
    );
    
    // Superfícies térmicas (False-color)
    this.thermalSurfaceOverlay.update(
      this.cv.T_int,
      params.T_ext,
      params.solarRadiation,
      this.cv.config.roofUValue,
      this.cv.config.shadingFactor,
      params.beddingWetness
    );
    
    // Heatmap
    this.heatmapRenderer.update(this.cv, horseWorldPositions, params.T_ext, fanEfficiency);
    
    // ─── PASSO 10: Atualizar HUD / Dashboard ─────────────────────────
    const comfort = getEquineComfortIndex(this.cv.T_filtered, this.cv.RH_filtered);
    
    let welfareTip = "Temperatura e umidade dentro do ideal. Os mecanismos de troca de calor latente (sudorese) funcionam sem sobrecarga metabólica.";
    if (comfort.status === 'WARNING') {
      welfareTip = "Alerta de calor leve. A dissipação de calor requer maior consumo de água. Recomenda-se acionar ventilação natural abrindo cortinas.";
    } else if (comfort.status === 'DANGER') {
      welfareTip = "ESTRESSE TÉRMICO GRAVE! O suor não evapora eficientemente. Perigo de desidratação e choque térmico. Ligue exaustores e nebulizadores imediatamente!";
    }
    
    this.ui.updateDashboard(
      this.cv.T_filtered,
      this.cv.RH_filtered,
      comfort.index,
      comfort.label,
      welfareTip
    );
    
    // ─── PASSO 11: Renderizar Cena Three.js ──────────────────────────
    this.sceneManager.render();
  };
}

// Iniciar a aplicação após o carregamento da página
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
