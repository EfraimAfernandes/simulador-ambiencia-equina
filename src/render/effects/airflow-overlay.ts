/**
 * airflow-overlay.ts
 *
 * Overlay visual de fluxo de ar por zona — acoplado a cv.airSpeed.
 */

import * as THREE from 'three';
import { temperatureToColor } from '../../domain/climate/thermal-palette.ts';

interface FlowArrow {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  group: THREE.Group;
  shaft: THREE.Mesh;
  head: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

export class AirflowOverlay {
  public group: THREE.Group;

  private arrows: FlowArrow[] = [];
  private readonly scratchColor = new THREE.Color();

  private readonly L: number;
  private readonly W: number;
  private readonly H: number;

  constructor(length: number, width: number, height: number) {
    this.L = length;
    this.W = width;
    this.H = height;

    this.group = new THREE.Group();
    this.group.name = 'airflow-overlay';
    this.group.visible = false;

    this.buildArrows();
  }

  private buildArrows(): void {
    const nx = 4;
    const nz = 3;
    const ny = 2;

    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        for (let iy = 0; iy < ny; iy++) {
          const x = -this.L / 2 + (ix + 0.5) * (this.L / nx);
          const z = -this.W / 2 + (iz + 0.5) * (this.W / nz);
          const y = 1.5 + iy * ((this.H - 1.5) / ny);
          const arrow = this.createArrow(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, -1));
          this.arrows.push(arrow);
          this.group.add(arrow.group);
        }
      }
    }

    for (let iz = 0; iz < 3; iz++) {
      const z = -this.W / 3 + iz * (this.W / 3);
      this.arrows.push(
        this.createArrow(new THREE.Vector3(-this.L / 2 + 0.5, this.H * 0.5, z), new THREE.Vector3(1, 0, 0))
      );
      this.group.add(this.arrows[this.arrows.length - 1].group);
    }

    for (let iz = 0; iz < 3; iz++) {
      const z = -this.W / 3 + iz * (this.W / 3);
      this.arrows.push(
        this.createArrow(new THREE.Vector3(this.L / 2 - 0.5, this.H * 0.5, z), new THREE.Vector3(-1, 0, 0))
      );
      this.group.add(this.arrows[this.arrows.length - 1].group);
    }

    for (const xPos of [-this.L / 4, this.L / 4]) {
      this.arrows.push(
        this.createArrow(new THREE.Vector3(xPos, this.H * 0.7, -this.W / 2 + 0.5), new THREE.Vector3(0, 0, -1))
      );
      this.group.add(this.arrows[this.arrows.length - 1].group);
    }
  }

  private createArrow(origin: THREE.Vector3, direction: THREE.Vector3): FlowArrow {
    const arrowGroup = new THREE.Group();
    arrowGroup.position.copy(origin);

    const material = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.65,
    });

    const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
    const shaft = new THREE.Mesh(shaftGeo, material);
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.set(0.3, 0, 0);
    arrowGroup.add(shaft);

    const headGeo = new THREE.ConeGeometry(0.08, 0.2, 6);
    const head = new THREE.Mesh(headGeo, material);
    head.rotation.z = -Math.PI / 2;
    head.position.set(0.7, 0, 0);
    arrowGroup.add(head);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.clone().normalize());
    arrowGroup.quaternion.copy(quaternion);

    return { origin, direction: direction.clone(), group: arrowGroup, shaft, head, material };
  }

  update(
    fanEfficiency: number,
    curtainOpening: number,
    tInt: number,
    _tExt: number,
    airSpeed: number
  ): void {
    if (!this.group.visible) return;

    const speedFactor = Math.min(2.0, Math.max(0.2, airSpeed * 2));
    const arrowColor = temperatureToColor(tInt, this.scratchColor);

    for (const arrow of this.arrows) {
      arrow.group.scale.setScalar(speedFactor);
      const intensity = Math.max(0.15, fanEfficiency * 0.6 + curtainOpening * 0.3 + 0.1);
      arrow.material.opacity = intensity;
      arrow.material.color.copy(arrowColor);
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  get isVisible(): boolean {
    return this.group.visible;
  }
}
