/**
 * test-control-logic.ts
 *
 * Testes de fidelidade da lógica evaluateControl() — espelho do firmware C++.
 * Executar: npx tsx scripts/test-control-logic.ts
 */

import { evaluateControl } from '../src/automation/control-logic.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const SP = { temp_max: 28.0, temp_min: 25.0, rh_max_limit: 80.0 };

console.log('\n=== Testes evaluateControl() ===\n');

// 1. Abaixo do limiar inferior — desliga
{
  const prev = { fan_1: true, fan_2: true, mist_pump: false };
  const r = evaluateControl({ t_int: 24.0, rh_int: 60 }, SP, prev);
  assert(!r.fan_1 && !r.fan_2, 'T=24°C desliga ventiladores');
  assert(!r.thermal_alert, 'T=24°C sem alerta térmico');
}

// 2. Acima do limiar superior — liga
{
  const prev = { fan_1: false, fan_2: false, mist_pump: false };
  const r = evaluateControl({ t_int: 29.0, rh_int: 60 }, SP, prev);
  assert(r.fan_1 && r.fan_2, 'T=29°C liga ambos ventiladores');
  assert(r.thermal_alert, 'T=29°C com alerta térmico');
}

// 3. Banda de histerese — mantém estado anterior
{
  const prevOn = { fan_1: true, fan_2: true, mist_pump: false };
  const rOn = evaluateControl({ t_int: 26.5, rh_int: 60 }, SP, prevOn);
  assert(rOn.fan_1 && rOn.fan_2, 'T=26.5°C mantém ventiladores ligados');

  const prevOff = { fan_1: false, fan_2: false, mist_pump: false };
  const rOff = evaluateControl({ t_int: 26.5, rh_int: 60 }, SP, prevOff);
  assert(!rOff.fan_1 && !rOff.fan_2, 'T=26.5°C mantém ventiladores desligados');
}

// 4. Nebulização — T crítica + RH abaixo do limite
{
  const prev = { fan_1: true, fan_2: true, mist_pump: false };
  const r = evaluateControl({ t_int: 30.0, rh_int: 70 }, SP, prev);
  assert(r.mist_pump, 'T=30°C RH=70% ativa nebulização');
}

// 5. Nebulização bloqueada — RH acima do limite sanitário
{
  const prev = { fan_1: true, fan_2: true, mist_pump: false };
  const r = evaluateControl({ t_int: 30.0, rh_int: 85 }, SP, prev);
  assert(!r.mist_pump, 'T=30°C RH=85% bloqueia nebulização');
}

// 6. Limiar exato temp_max
{
  const prev = { fan_1: false, fan_2: false, mist_pump: false };
  const r = evaluateControl({ t_int: 28.0, rh_int: 60 }, SP, prev);
  assert(r.fan_1 && r.fan_2, 'T=28.0°C (exato) liga ventiladores');
}

// 7. Limiar exato temp_min
{
  const prev = { fan_1: true, fan_2: true, mist_pump: false };
  const r = evaluateControl({ t_int: 25.0, rh_int: 60 }, SP, prev);
  assert(!r.fan_1 && !r.fan_2, 'T=25.0°C (exato) desliga ventiladores');
}

console.log(`\nResultado: ${passed} passou, ${failed} falhou\n`);
process.exit(failed > 0 ? 1 : 0);
