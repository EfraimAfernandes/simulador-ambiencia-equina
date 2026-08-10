import * as THREE from 'three';
import { ControlVolume } from '../../sim/state/control-volume.ts';
import { temperatureToCssHsla } from '../../domain/climate/thermal-palette.ts';

export class HeatmapRenderer {
  public mesh: THREE.Mesh;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  private L: number;
  private W: number;

  constructor(cv: ControlVolume) {
    this.L = cv.config.length;
    this.W = cv.config.width;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 128;
    this.canvas.height = 128;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Não foi possível inicializar o Contexto 2D no canvas do Heatmap.');
    }
    this.ctx = context;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;

    const planeGeo = new THREE.PlaneGeometry(this.L, this.W);
    const planeMat = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.1,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(planeGeo, planeMat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 1.25;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  public update(
    cv: ControlVolume,
    horsePositions: THREE.Vector3[],
    extTemp: number,
    fanEfficiency: number
  ): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Base = ar interno (T_int); quente → laranja/vermelho, frio → azul
    ctx.fillStyle = temperatureToCssHsla(cv.T_int);
    ctx.fillRect(0, 0, cw, ch);

    const plumeRadius = 14 + Math.min(8, cv.Q_metabolic / 400);

    horsePositions.forEach((pos) => {
      const px = ((pos.x + this.L / 2) / this.L) * cw;
      const py = ((pos.z + this.W / 2) / this.W) * ch;

      const grad = ctx.createRadialGradient(px, py, 1, px, py, plumeRadius);
      grad.addColorStop(0, temperatureToCssHsla(cv.T_int + Math.min(4, cv.Q_metabolic / 600)));
      grad.addColorStop(0.25, temperatureToCssHsla(cv.T_int + 1.5));
      grad.addColorStop(0.5, temperatureToCssHsla(cv.T_int));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath();
      ctx.arc(px, py, plumeRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';

    const inletGradL = ctx.createLinearGradient(0, 0, 0, ch * 0.15);
    inletGradL.addColorStop(0, temperatureToCssHsla(extTemp, 0.75));
    inletGradL.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = inletGradL;
    ctx.fillRect(0, 0, cw, ch * 0.15);

    const inletGradR = ctx.createLinearGradient(0, ch, 0, ch * 0.85);
    inletGradR.addColorStop(0, temperatureToCssHsla(extTemp, 0.75));
    inletGradR.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = inletGradR;
    ctx.fillRect(0, ch * 0.85, cw, ch * 0.15);

    if (fanEfficiency > 0.05) {
      const exGrad = ctx.createRadialGradient(cw / 2, 0, 2, cw / 2, 0, cw * 0.3);
      exGrad.addColorStop(0, temperatureToCssHsla(cv.T_int - 1.0, 0.5 * fanEfficiency));
      exGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = exGrad;
      ctx.fillRect(cw * 0.15, 0, cw * 0.7, ch * 0.35);
    }

    this.texture.needsUpdate = true;
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}
