import * as THREE from 'three';
import { temperatureToColor } from '../../domain/climate/thermal-palette.ts';

interface ParticleData {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  temp: number;
}

/** Referência de velocidade do ar para escala adimensional (m/s) */
const REF_AIR_SPEED = 0.5;

export class AirflowParticleSystem {
  public points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;

  private particles: ParticleData[] = [];
  private readonly maxParticles = 1600;

  private readonly L: number;
  private readonly W: number;
  private readonly H: number;

  private readonly scratchColor = new THREE.Color();
  private readonly vTarget = new THREE.Vector3();
  private readonly fan1 = new THREE.Vector3();
  private readonly fan2 = new THREE.Vector3();

  constructor(length: number, width: number, height: number) {
    this.L = length;
    this.W = width;
    this.H = height;

    this.fan1.set(-this.L / 4, this.H * 0.7, -this.W / 2);
    this.fan2.set(this.L / 4, this.H * 0.7, -this.W / 2);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxParticles * 3), 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.maxParticles * 3), 3));

    this.material = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      blending: THREE.NormalBlending,
      depthWrite: true,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.initParticles();
  }

  private initParticles(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.spawnInside(24, 26, true));
    }
    this.updateBuffers();
  }

  /** Spawna partícula exclusivamente dentro do volume de controle */
  private spawnInside(_extTemp: number, cvTemp: number, randomizeLife = false): ParticleData {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * this.L * 0.92,
      1.0 + Math.random() * (this.H - 1.2),
      (Math.random() - 0.5) * this.W * 0.92
    );

    return {
      pos,
      vel: new THREE.Vector3(0, 0, 0),
      life: randomizeLife ? Math.random() * 6 : 0,
      maxLife: 5 + Math.random() * 6,
      temp: cvTemp + (Math.random() - 0.5) * 0.5,
    };
  }

  private isInsideBarn(x: number, y: number, z: number, roofHeight: number): boolean {
    return Math.abs(x) < this.L / 2 && Math.abs(z) < this.W / 2 && y < roofHeight;
  }

  public update(
    dt: number,
    cvTemp: number,
    extTemp: number,
    curtainOpening: number,
    horsePositions: THREE.Vector3[],
    structuralPreset: 'traditional' | 'premium',
    airSpeed: number,
    fanEfficiency: number,
    metabolicHeat: number,
    ventMechanical: number,
    ventStack: number,
    ventCurtain: number,
    ventTotal: number
  ): void {
    const positions = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;

    const isPremium = structuralPreset === 'premium';
    const speedScale = Math.max(0.05, airSpeed / REF_AIR_SPEED);
    const totalFlow = Math.max(ventTotal, 0.001);
    const stackRatio = ventStack / totalFlow;
    const curtainRatio = ventCurtain / totalFlow;
    const mechRatio = ventMechanical / totalFlow;
    const fanStrength = fanEfficiency * speedScale;
    const isFanOn = fanStrength > 0.05;
    const deltaT = Math.max(0, cvTemp - extTemp);
    const plumeHeatDelta = Math.min(4, metabolicHeat / 600);
    const plumeVelScale = Math.min(1.2, metabolicHeat / 1200);
    const buoyancyForce = isPremium ? 0.015 : 0.05;
    const turbAmp = airSpeed * 0.1 * (isPremium ? 0.35 : 0.85);
    const tempLerpRate = 0.12;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles[i] = this.spawnInside(extTemp, cvTemp);
        continue;
      }

      const roofHeight = this.H + (this.W / 2 - Math.abs(p.pos.z)) * 0.25;
      const insideBarn = this.isInsideBarn(p.pos.x, p.pos.y, p.pos.z, roofHeight);
      this.vTarget.set(0, 0, 0);

      if (insideBarn) {
        p.temp = THREE.MathUtils.lerp(p.temp, cvTemp, dt * tempLerpRate);

        if (isFanOn) {
          const d1 = p.pos.distanceTo(this.fan1);
          const d2 = p.pos.distanceTo(this.fan2);
          const dist = Math.min(d1, d2);
          const targetFan = d1 < d2 ? this.fan1 : this.fan2;
          const pullDir = new THREE.Vector3().subVectors(targetFan, p.pos).normalize();
          const suctionForce = (fanStrength * mechRatio * 5.0) / (dist * dist + 0.4);
          this.vTarget.addScaledVector(pullDir, suctionForce);
          this.vTarget.z += -0.4 * fanStrength * (1 - (p.pos.z + this.W / 2) / this.W);
        } else {
          const windIn = speedScale * curtainOpening * curtainRatio * REF_AIR_SPEED;
          this.vTarget.x += windIn * 0.6;
        }

        const buoyancy = deltaT * buoyancyForce * (1 + stackRatio);
        this.vTarget.y += buoyancy;

        for (const horsePos of horsePositions) {
          const dx = p.pos.x - horsePos.x;
          const dz = p.pos.z - horsePos.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < 2.0 && p.pos.y > horsePos.y && p.pos.y < horsePos.y + 5.0) {
            const heightFrac = 1 - (p.pos.y - horsePos.y) / 5.0;
            const plumeY = Math.exp(-distSq * 0.9) * heightFrac * plumeVelScale * (isPremium ? 0.5 : 1);
            this.vTarget.y += plumeY;
            p.temp = THREE.MathUtils.lerp(p.temp, cvTemp + plumeHeatDelta, dt * tempLerpRate * 1.5);
          }
        }

        const distLeft = p.pos.x - -this.L / 2;
        const distRight = this.L / 2 - p.pos.x;
        const inflowMag = curtainOpening * curtainRatio * speedScale * REF_AIR_SPEED * 2;
        this.vTarget.x += Math.exp(-distLeft * 0.7) * inflowMag;
        this.vTarget.x -= Math.exp(-distRight * 0.7) * inflowMag;

        if (Math.abs(p.pos.x + 4) < 0.2 || Math.abs(p.pos.x - 4) < 0.2) {
          if (Math.abs(p.pos.z) > 1.25 && p.pos.y < 1.8) {
            this.vTarget.x = 0;
          }
        }
        if (Math.abs(p.pos.z) > this.W / 2 - 0.15 && p.pos.y < 1.0) {
          this.vTarget.z = 0;
        }
        if (Math.abs(p.pos.x) > this.L / 2 - 0.15 && (p.pos.y < 1.0 || curtainOpening < 0.1)) {
          this.vTarget.x = 0;
        }

        const tx = Math.sin(p.pos.z * 1.5) * Math.cos(p.pos.y * 1.0);
        const ty = Math.cos(p.pos.x * 1.0) * Math.sin(p.pos.z * 1.5);
        const tz = Math.sin(p.pos.x * 1.5) * Math.cos(p.pos.y * 1.0);
        this.vTarget.addScaledVector(new THREE.Vector3(tx, ty, tz), turbAmp);

        if (!isPremium) {
          const nearLanternim = Math.abs(p.pos.z) < 0.5 && p.pos.y > roofHeight - 0.4;
          if (nearLanternim && stackRatio > 0.05) {
            this.vTarget.y += stackRatio * speedScale * 0.6;
          }
        }
      } else {
        p.temp = THREE.MathUtils.lerp(p.temp, extTemp, dt * tempLerpRate);
        this.vTarget.set(REF_AIR_SPEED * speedScale * 0.3, 0, 0);
      }

      p.vel.lerp(this.vTarget, dt * 2.5);
      p.vel.clampLength(0.01, airSpeed * 3 + 0.5);
      p.pos.addScaledVector(p.vel, dt);

      if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.y = Math.abs(p.vel.y) * 0.15;
      }

      if (insideBarn) {
        if (isPremium) {
          if (p.pos.y > this.H - 0.08) {
            p.pos.y = this.H - 0.08;
            p.vel.y = -Math.abs(p.vel.y) * 0.2;
          }
        } else {
          const nearLanternim = Math.abs(p.pos.z) < 0.5 && p.pos.y > roofHeight - 0.25;
          const nearEaves = Math.abs(p.pos.x) > this.L / 2 - 0.3 && p.pos.y > this.H - 0.25;
          if (!nearLanternim && !nearEaves && p.pos.y > roofHeight - 0.12) {
            p.pos.y = roofHeight - 0.12;
            p.vel.y = -Math.abs(p.vel.y) * 0.3;
          }
        }
      }

      if (
        Math.abs(p.pos.x) > this.L / 2 + 0.5 ||
        Math.abs(p.pos.z) > this.W / 2 + 0.5 ||
        p.pos.y > this.H + 1.5 ||
        p.pos.y < 0
      ) {
        this.particles[i] = this.spawnInside(extTemp, cvTemp);
        continue;
      }

      positions[i * 3] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;

      temperatureToColor(p.temp, this.scratchColor);
      colors[i * 3] = this.scratchColor.r;
      colors[i * 3 + 1] = this.scratchColor.g;
      colors[i * 3 + 2] = this.scratchColor.b;
    }

    this.updateBuffers();
  }

  private updateBuffers(): void {
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public setVisible(visible: boolean): void {
    this.points.visible = visible;
  }
}
