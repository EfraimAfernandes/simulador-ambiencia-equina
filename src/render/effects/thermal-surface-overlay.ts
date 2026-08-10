/**
 * thermal-surface-overlay.ts
 * 
 * Overlay de temperatura de superfície aplicado à cobertura e paredes.
 * 
 * Exibe false-color (azul → verde → amarelo → vermelho) sobre as
 * superfícies da edificação para indicar a temperatura estimada
 * de cada superfície.
 * 
 * Superfícies modeladas:
 * - Cobertura (recebe radiação solar direta)
 * - Parede traseira
 * - Parede frontal
 * - Piso (acumula calor e umidade)
 * 
 * A temperatura de superfície é estimada com base em:
 * - Temperatura externa
 * - Radiação solar incidente
 * - U-value do material
 * - Temperatura interna (face interior)
 */

import * as THREE from 'three';
import {
  temperatureToColor,
  THERMAL_MIN_C,
  THERMAL_MAX_C,
} from '../../domain/climate/thermal-palette.ts';

export class ThermalSurfaceOverlay {
  public group: THREE.Group;
  
  private roofPlaneLeft: THREE.Mesh;
  private roofPlaneRight: THREE.Mesh;
  private floorPlane: THREE.Mesh;
  
  private roofMaterial: THREE.MeshBasicMaterial;
  private floorMaterial: THREE.MeshBasicMaterial;
  private readonly legendScratch = new THREE.Color();

  private L: number;
  private W: number;
  private H: number;
  
  constructor(length: number, width: number, height: number) {
    this.L = length;
    this.W = width;
    this.H = height;
    
    this.group = new THREE.Group();
    this.group.name = 'thermal-surface-overlay';
    this.group.visible = false; // Começa oculto
    
    // ─── Overlay da Cobertura (dois planos inclinados) ──────────────
    this.roofMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      color: 0x22c55e,
    });
    
    const roofSlope = 0.25;
    const roofOverhang = 0.5;
    const roofHalfW = width / 2 + roofOverhang;
    const roofH = roofHalfW * roofSlope;
    
    const roofGeo = new THREE.PlaneGeometry(length + 0.4, roofHalfW);
    
    // Telhado esquerdo (Z positivo)
    this.roofPlaneLeft = new THREE.Mesh(roofGeo, this.roofMaterial.clone());
    const angle = Math.atan(roofSlope);
    this.roofPlaneLeft.rotation.x = -Math.PI / 2 + angle;
    this.roofPlaneLeft.position.set(0, height + roofH / 2 + 0.02, roofHalfW / 2 - roofOverhang / 2);
    this.group.add(this.roofPlaneLeft);
    
    // Telhado direito (Z negativo)
    this.roofPlaneRight = new THREE.Mesh(roofGeo, this.roofMaterial.clone());
    this.roofPlaneRight.rotation.x = -Math.PI / 2 - angle;
    this.roofPlaneRight.position.set(0, height + roofH / 2 + 0.02, -roofHalfW / 2 + roofOverhang / 2);
    this.group.add(this.roofPlaneRight);
    
    // ─── Overlay do Piso ────────────────────────────────────────────
    this.floorMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      color: 0x06b6d4,
    });
    
    const floorGeo = new THREE.PlaneGeometry(length, width);
    this.floorPlane = new THREE.Mesh(floorGeo, this.floorMaterial);
    this.floorPlane.rotation.x = -Math.PI / 2;
    this.floorPlane.position.set(0, 0.02, 0); // Ligeiramente acima do chão
    this.group.add(this.floorPlane);
    
    // ─── Legenda de temperatura ─────────────────────────────────────
    this.buildLegend();
  }
  
  /**
   * Constrói uma legenda de cores no canto do overlay.
   */
  private buildLegend(): void {
    const legendGroup = new THREE.Group();
    legendGroup.name = 'thermal-legend';
    
    const barWidth = 0.15;
    const barHeight = 2.0;
    const segments = 20;
    
    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1);
      const temp = THERMAL_MIN_C + t * (THERMAL_MAX_C - THERMAL_MIN_C);
      const color = temperatureToColor(temp, this.legendScratch);
      
      const segGeo = new THREE.BoxGeometry(barWidth, barHeight / segments, 0.02);
      const segMat = new THREE.MeshBasicMaterial({ color });
      const seg = new THREE.Mesh(segGeo, segMat);
      seg.position.set(0, t * barHeight - barHeight / 2, 0);
      legendGroup.add(seg);
    }
    
    legendGroup.position.set(-this.L / 2 - 1, this.H / 2, -this.W / 2);
    this.group.add(legendGroup);
  }
  
  private estimateFloorTemp(tInt: number, beddingWetness: number): number {
    const evapCooling = beddingWetness * 3;
    return tInt - 1 - evapCooling;
  }

  /**
   * Estima a temperatura de superfície da cobertura.
   *
   * Modelo simplificado:
   * T_surf = T_ext + (α × G / h_ext) × (U / (U + h_ext))
   */
  private estimateRoofSurfaceTemp(
    tExt: number,
    solarRadiation: number,
    roofUValue: number,
    shadingFactor: number,
    _tInt: number
  ): number {
    const alpha = 0.5; // Absortância média
    const h_ext = 15;  // W/m²K (convecção exterior)
    
    const effectiveRadiation = solarRadiation * (1 - shadingFactor);
    const solarGain = (alpha * effectiveRadiation) / h_ext;
    
    // Temperatura da superfície exterior da cobertura
    const tSurf = tExt + solarGain * (roofUValue / (roofUValue + h_ext));
    
    return tSurf;
  }

  /**
   * Atualiza as cores do overlay com base nas condições atuais.
   */
  update(
    tInt: number,
    tExt: number,
    solarRadiation: number,
    roofUValue: number,
    shadingFactor: number,
    beddingWetness: number
  ): void {
    if (!this.group.visible) return;
    
    // ─── Temperatura da cobertura ───────────────────────────────────
    const roofTemp = this.estimateRoofSurfaceTemp(tExt, solarRadiation, roofUValue, shadingFactor, tInt);
    const roofColor = temperatureToColor(roofTemp, this.legendScratch);
    
    (this.roofPlaneLeft.material as THREE.MeshBasicMaterial).color.copy(roofColor);
    (this.roofPlaneRight.material as THREE.MeshBasicMaterial).color.copy(roofColor);
    
    // Opacidade mais intensa quando mais quente
    const roofOpacity = 0.25 + Math.min(0.5, (roofTemp - 20) / 40);
    (this.roofPlaneLeft.material as THREE.MeshBasicMaterial).opacity = roofOpacity;
    (this.roofPlaneRight.material as THREE.MeshBasicMaterial).opacity = roofOpacity;
    
    // ─── Temperatura do piso ────────────────────────────────────────
    const floorTemp = this.estimateFloorTemp(tInt, beddingWetness);
    const floorColor = temperatureToColor(floorTemp, this.legendScratch);
    
    this.floorMaterial.color.copy(floorColor);
    this.floorMaterial.opacity = 0.2 + Math.min(0.4, Math.max(0, (floorTemp - 18) / 30));
  }
  
  /** Alterna visibilidade */
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
  
  get isVisible(): boolean {
    return this.group.visible;
  }
}
