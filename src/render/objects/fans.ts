/**
 * fans.ts
 * 
 * Renderização de ventiladores com estado operacional visível.
 * 
 * Cada ventilador 3D possui:
 * - Aro externo (carcaça)
 * - 4 pás com inclinação realista
 * - Rotação proporcional ao RPM (gradual, não instantânea)
 * - LED indicador de estado (verde/amarelo/vermelho/cinza)
 * - Label com RPM e consumo (modo automação)
 * 
 * As pás giram com velocidade proporcional ao RPM do FanController,
 * criando feedback visual direto do efeito físico.
 */

import * as THREE from 'three';
import type { ActuatorState } from '../../iot/message-schema.ts';

/** Configuração de posicionamento de um ventilador */
export interface FanPlacement {
  id: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;  // Para onde o ar é soprado/exaurido
  radius: number;            // metros
}

/** Estado visual a ser atualizado por frame */
export interface FanVisualState {
  rpm: number;
  state: ActuatorState;
  power: number;        // Watts
  flowRate: number;     // m³/h
}

export class FanRenderer {
  public group: THREE.Group;
  
  private fans: Map<string, {
    bladesGroup: THREE.Group;
    ledMesh: THREE.Mesh;
    ledMaterial: THREE.MeshBasicMaterial;
    currentRotationSpeed: number;
  }> = new Map();
  
  // Cores dos LEDs por estado
  private static readonly LED_COLORS: Record<ActuatorState, number> = {
    'off':      0x475569,  // Cinza apagado
    'starting': 0xeab308,  // Amarelo
    'running':  0x22c55e,  // Verde
    'stopping': 0xf97316,  // Laranja
    'fault':    0xef4444,  // Vermelho
  };
  
  constructor(placements: FanPlacement[]) {
    this.group = new THREE.Group();
    this.group.name = 'fan-renderer-group';
    
    for (const placement of placements) {
      this.buildFan(placement);
    }
  }
  
  /**
   * Constrói a geometria de um ventilador individual.
   */
  private buildFan(placement: FanPlacement): void {
    const { id, position, radius } = placement;
    
    const fanGroup = new THREE.Group();
    fanGroup.name = `fan-${id}`;
    fanGroup.position.copy(position);
    
    // ─── Carcaça (aro externo) ──────────────────────────────────────
    const rimGeo = new THREE.RingGeometry(radius * 0.92, radius, 32);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.castShadow = true;
    fanGroup.add(rim);
    
    // ─── Pás do ventilador ──────────────────────────────────────────
    const bladesGroup = new THREE.Group();
    bladesGroup.name = `blades-${id}`;
    bladesGroup.position.z = 0.03; // Ligeiramente à frente do aro
    
    const bladeGeo = new THREE.BoxGeometry(0.1, radius * 0.85, 0.02);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });
    
    // 4 pás com inclinação
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = (i * Math.PI) / 2;
      blade.rotation.y = 0.3; // Inclinação da hélice
      blade.castShadow = true;
      bladesGroup.add(blade);
    }
    
    // Hub central
    const hubGeo = new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, 0.06, 16);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.1,
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    bladesGroup.add(hub);
    
    fanGroup.add(bladesGroup);
    
    // ─── LED Indicador de Estado ────────────────────────────────────
    const ledGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({
      color: FanRenderer.LED_COLORS['off'],
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(radius + 0.15, radius * 0.8, 0);
    fanGroup.add(led);
    
    // ─── Guardar referência ─────────────────────────────────────────
    this.fans.set(id, {
      bladesGroup,
      ledMesh: led,
      ledMaterial: ledMat,
      currentRotationSpeed: 0,
    });
    
    this.group.add(fanGroup);
  }
  
  /**
   * Atualiza a rotação das pás e o LED de estado de um ventilador.
   * 
   * @param id ID do ventilador
   * @param state Estado visual
   * @param dt Delta time real (segundos)
   */
  updateFan(id: string, state: FanVisualState, dt: number): void {
    const fan = this.fans.get(id);
    if (!fan) return;
    
    // ─── Rotação das pás ────────────────────────────────────────────
    // RPM → radianos por segundo: ω = RPM × (2π / 60)
    const targetSpeed = (state.rpm * 2 * Math.PI) / 60;
    
    // Suavização visual (lerp) para evitar saltos
    fan.currentRotationSpeed = THREE.MathUtils.lerp(
      fan.currentRotationSpeed,
      targetSpeed,
      Math.min(1.0, 3.0 * dt)
    );
    
    if (fan.currentRotationSpeed > 0.01) {
      fan.bladesGroup.rotation.z += fan.currentRotationSpeed * dt;
    }
    
    // ─── LED de estado ──────────────────────────────────────────────
    const targetColor = FanRenderer.LED_COLORS[state.state] ?? FanRenderer.LED_COLORS['off'];
    fan.ledMaterial.color.setHex(targetColor);
    
    // Efeito de piscar para estados transitórios
    if (state.state === 'starting' || state.state === 'stopping') {
      const blink = Math.sin(Date.now() * 0.01) > 0;
      fan.ledMesh.visible = blink;
    } else if (state.state === 'fault') {
      // Piscar rápido para falha
      const blink = Math.sin(Date.now() * 0.02) > 0;
      fan.ledMesh.visible = blink;
    } else {
      fan.ledMesh.visible = true;
    }
  }
  
  /**
   * Atualiza todos os ventiladores de uma vez.
   * 
   * @param states Mapa de ID → estado visual
   * @param dt Delta time real (segundos)
   */
  updateAll(states: Map<string, FanVisualState>, dt: number): void {
    for (const [id, state] of states) {
      this.updateFan(id, state, dt);
    }
  }
  
  /** Alterna visibilidade do grupo inteiro */
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
