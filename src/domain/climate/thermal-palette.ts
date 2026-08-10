/**
 * thermal-palette.ts
 *
 * Escala térmica unificada (15–40 °C) para todos os overlays visuais.
 *
 * Convenção acadêmica (sempre respeitada):
 *   FRIO  → azul / ciano
 *   MORNO → verde / amarelo
 *   QUENTE → laranja / vermelho
 */

import * as THREE from 'three';

export const THERMAL_MIN_C = 15;
export const THERMAL_MAX_C = 40;

/** Azul — frio */
const COLD = new THREE.Color(0x2563eb);
/** Ciano — frio moderado */
const COOL = new THREE.Color(0x06b6d4);
/** Verde — conforto */
const MILD = new THREE.Color(0x22c55e);
/** Amarelo — morno */
const WARM = new THREE.Color(0xeab308);
/** Laranja — quente */
const HOT = new THREE.Color(0xf97316);
/** Vermelho — estresse térmico */
const VERY_HOT = new THREE.Color(0xef4444);

const _cssScratch = new THREE.Color();

/** Normaliza temperatura para [0, 1]: 0 = frio (15 °C), 1 = quente (40 °C) */
export function normalizeTemperature(temp: number): number {
  return Math.max(0, Math.min(1, (temp - THERMAL_MIN_C) / (THERMAL_MAX_C - THERMAL_MIN_C)));
}

/**
 * Mapeia temperatura → cor Three.js.
 * Baixa T → azul · Alta T → laranja/vermelho.
 */
export function temperatureToColor(temp: number, target: THREE.Color): THREE.Color {
  const t = normalizeTemperature(temp);

  if (t < 0.2) {
    return target.copy(COLD).lerp(COOL, t / 0.2);
  }
  if (t < 0.4) {
    return target.copy(COOL).lerp(MILD, (t - 0.2) / 0.2);
  }
  if (t < 0.6) {
    return target.copy(MILD).lerp(WARM, (t - 0.4) / 0.2);
  }
  if (t < 0.8) {
    return target.copy(WARM).lerp(HOT, (t - 0.6) / 0.2);
  }
  return target.copy(HOT).lerp(VERY_HOT, (t - 0.8) / 0.2);
}

/** Cor CSS derivada da mesma função RGB (garante paridade heatmap ↔ partículas) */
export function temperatureToCssHsla(temp: number, alpha = 1): string {
  temperatureToColor(temp, _cssScratch);
  const r = Math.round(_cssScratch.r * 255);
  const g = Math.round(_cssScratch.g * 255);
  const b = Math.round(_cssScratch.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Labels para legenda */
export const THERMAL_LEGEND_STOPS: ReadonlyArray<{ temp: number; label: string }> = [
  { temp: 15, label: '15°C (frio)' },
  { temp: 25, label: '25°C (conforto)' },
  { temp: 32, label: '32°C (quente)' },
  { temp: 40, label: '40°C (crítico)' },
];
