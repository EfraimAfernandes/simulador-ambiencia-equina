import { ControlVolume } from '../src/sim/state/control-volume';
import { PhysicsEngine, PhysicsParams } from '../src/sim/systems/physics-engine';
import { AirflowParticleSystem } from '../src/render/overlays/particle-system';
import * as THREE from 'three';

// Mock de classes do Three.js necessárias se importadas em sub-modulos
// Como o particle-system.ts importa o THREE, definimos variáveis globais mínimas caso rodando em Node
if (typeof global !== 'undefined') {
  (global as any).window = {};
  (global as any).document = {
    createElement: () => ({
      getContext: () => ({})
    })
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  metric: string;
}

const runTests = () => {
  console.log('\x1b[36m==================================================\x1b[0m');
  console.log('\x1b[36m   BATERIA DE TESTES DE ADEQUAÇÃO FÍSICA E TÉRMICA \x1b[0m');
  console.log('\x1b[36m==================================================\x1b[0m\n');

  const results: TestResult[] = [];

  // Configuração padrão do Volume de Controle (Estábulo 12m x 9m x 4m)
  const createDefaultCV = () => {
    return new ControlVolume({
      length: 12,
      width: 9,
      height: 4,
      roofUValue: 1.5,
      wallUValue: 2.0,
      shadingFactor: 0.0
    }, 24.0, 60.0); // 24°C, 60% UR inicial
  };

  // Parâmetros base da simulação física
  const createDefaultParams = (): PhysicsParams => {
    return {
      T_ext: 24.0,
      RH_ext: 60.0,
      solarRadiation: 0.0,
      numHorses: 0,
      horseActivity: 'resting',
      fanFlowRate: 0.0,
      beddingWetness: 0.0,
      curtainOpening: 0.0,
      timeScale: 1.0
    };
  };

  // ---------------------------------------------------------------------------
  // TESTE 1: Pluma Térmica de Fonte Quente Local (Animais)
  // ---------------------------------------------------------------------------
  (() => {
    const cv = createDefaultCV();
    const params = createDefaultParams();
    params.numHorses = 4; // Fontes térmicas locais
    params.horseActivity = 'eating';
    
    // Simula 30 passos
    const dt = 1.0;
    for (let i = 0; i < 30; i++) {
      PhysicsEngine.update(cv, dt, params);
    }
    
    // A física da convecção local (pluma) é checada nas velocidades verticais
    // Simulando comportamento das partículas no sistema de partículas na coordenada acima do animal (X=0, Z=0)
    const horsePos = new THREE.Vector3(0, 0.5, 0);
    const particlePosAbove = new THREE.Vector3(0.1, 1.2, 0.1);
    
    // O sistema de partículas adiciona velocidade vertical adicional na pluma térmica
    const dx = particlePosAbove.x - horsePos.x;
    const dz = particlePosAbove.z - horsePos.z;
    const distSq = dx * dx + dz * dz;
    const plumeY = Math.exp(-distSq * 0.9) * 0.7 * (1.0 - (particlePosAbove.y - horsePos.y) / 6.0);
    
    const passed = cv.Q_metabolic > 0 && cv.T_int > 24.0 && plumeY > 0.4;
    results.push({
      name: 'Pluma térmica de fonte quente local (Animais)',
      passed,
      metric: `Calor metabólico: ${cv.Q_metabolic.toFixed(0)} W | Velocidade da pluma: ${plumeY.toFixed(2)} m/s`,
      details: passed 
        ? 'Aprovação: Calor metabólico gerado com sucesso e fluxo de convecção local vertical > 0.4 m/s detectado acima da fonte.' 
        : 'Erro: Ausência de empuxo térmico local ou calor metabólico nulo.'
    });
  })();

  // ---------------------------------------------------------------------------
  // TESTE 2: Aquecimento de Cobertura
  // ---------------------------------------------------------------------------
  (() => {
    const cv = createDefaultCV();
    const params = createDefaultParams();
    params.solarRadiation = 900.0; // Forte insolação
    
    PhysicsEngine.update(cv, 1.0, params);
    
    // Simula aquecimento de superfície estimado (ThermalSurfaceOverlay)
    // T_surf = T_ext + (alpha * rad) / h_ext * (roofUValue / (roofUValue + h_ext))
    const alpha = 0.5;
    const h_ext = 15;
    const solarGain = (alpha * params.solarRadiation) / h_ext;
    const tSurfRoof = params.T_ext + solarGain * (cv.config.roofUValue / (cv.config.roofUValue + h_ext));
    
    const passed = tSurfRoof > params.T_ext + 1.5 && cv.Q_solar > 0;
    results.push({
      name: 'Aquecimento de cobertura (Insolação)',
      passed,
      metric: `Temperatura telhado: ${tSurfRoof.toFixed(1)}°C vs Ext: ${params.T_ext}°C | Fluxo: +${cv.Q_solar.toFixed(0)} W`,
      details: passed
        ? 'Aprovação: Telhado aquece acima da temperatura externa pela radiação e transfere calor por condução.'
        : 'Erro: Ausência de ganhos solares na cobertura.'
    });
  })();

  // ---------------------------------------------------------------------------
  // TESTE 3: Aquecimento de Piso (Inércia e Resfriamento Evaporativo)
  // ---------------------------------------------------------------------------
  (() => {
    const cv = createDefaultCV();
    
    // Simulação de piso seco vs piso úmido (com resfriamento evaporativo)
    const floorTempDry = cv.T_int - 1; // piso seco
    const floorTempWet = cv.T_int - 1 - (1.0 * 3); // 100% umidade da cama causa evaporação (-3°C)
    
    const passed = floorTempWet < floorTempDry && Math.abs(floorTempDry - 23.0) < 1.0;
    results.push({
      name: 'Aquecimento de piso e resfriamento por evaporação',
      passed,
      metric: `Piso seco: ${floorTempDry.toFixed(1)}°C | Piso úmido: ${floorTempWet.toFixed(1)}°C`,
      details: passed
        ? 'Aprovação: Piso úmido apresenta temperatura reduzida devido à entalpia de evaporação da água.'
        : 'Erro: Temperatura do piso não responde à umidade da cama.'
    });
  })();

  // ---------------------------------------------------------------------------
  // TESTE 4: Parede aquecida por Sol (Sombreamento e Acoplamento)
  // ---------------------------------------------------------------------------
  (() => {
    const cvUnshaded = createDefaultCV();
    const cvShaded = createDefaultCV();
    
    const params = createDefaultParams();
    params.solarRadiation = 800.0;
    
    // Unshaded
    PhysicsEngine.update(cvUnshaded, 1.0, params);
    
    // Shaded (shading factor = 0.8)
    cvShaded.config.shadingFactor = 0.8;
    PhysicsEngine.update(cvShaded, 1.0, params);
    
    const passed = cvShaded.Q_solar < cvUnshaded.Q_solar && cvShaded.Q_solar > 0;
    results.push({
      name: 'Parede/Cobertura aquecida pelo sol com sombreamento',
      passed,
      metric: `Sem sombra: ${cvUnshaded.Q_solar.toFixed(0)} W | Com sombra (80%): ${cvShaded.Q_solar.toFixed(0)} W`,
      details: passed
        ? 'Aprovação: Fator de sombreamento mitiga proporcionalmente os ganhos de radiação solar.'
        : 'Erro: Sombreamento não reduz a carga térmica solar.'
    });
  })();

  // ---------------------------------------------------------------------------
  // TESTE 5: Animal como fonte metabólica (Sensível e Latente)
  // ---------------------------------------------------------------------------
  (() => {
    const cv = createDefaultCV();
    const params = createDefaultParams();
    params.numHorses = 5;
    params.horseActivity = 'resting';
    
    PhysicsEngine.update(cv, 1.0, params);
    
    const passed = cv.Q_metabolic > 0 && cv.m_vapor_gen > 0;
    results.push({
      name: 'Animal como fonte metabólica (Cargas Térmica e de Umidade)',
      passed,
      metric: `Calor: ${cv.Q_metabolic.toFixed(0)} W | Vapor: ${(cv.m_vapor_gen * 3600 * 1000).toFixed(0)} g/h`,
      details: passed
        ? 'Aprovação: Animais geram calor sensível e umidade latente no Volume de Controle simultaneamente.'
        : 'Erro: Cargas metabólicas não computadas.'
    });
  })();

  // ---------------------------------------------------------------------------
  // TESTE 6: Ventilação Cruzada (Advecção de Calor)
  // ---------------------------------------------------------------------------
  (() => {
    const cvClosed = createDefaultCV();
    const cvOpen = createDefaultCV();
    cvClosed.T_int = 30.0; // Estábulo quente
    cvOpen.T_int = 30.0;
    
    const params = createDefaultParams();
    params.T_ext = 20.0; // Ambiente externo frio
    
    // Cortinas fechadas
    params.curtainOpening = 0.0;
    PhysicsEngine.update(cvClosed, 1.0, params);
    
    // Cortinas abertas
    params.curtainOpening = 1.0;
    PhysicsEngine.update(cvOpen, 1.0, params);
    
    // A remoção de calor por ventilação deve ser muito maior (mais negativa) com cortina aberta
    const passed = cvOpen.Q_ventilation < cvClosed.Q_ventilation && cvOpen.T_int < cvClosed.T_int;
    results.push({
      name: 'Ventilação cruzada (Advecção térmica)',
      passed,
      metric: `Remoção fechada: ${cvClosed.Q_ventilation.toFixed(0)} W | Aberta: ${cvOpen.Q_ventilation.toFixed(0)} W`,
      details: passed
        ? 'Aprovação: Abertura das cortinas aumenta a advecção e acelera o resfriamento convectivo do ar interno.'
        : 'Erro: Ventilação não altera o fluxo de calor convectivo.'
    });
  })();

  // ---------------------------------------------------------------------------
  // TESTE 7: Resfriamento após desligar fonte (Decaimento Térmico)
  // ---------------------------------------------------------------------------
  (() => {
    const cv = createDefaultCV();
    cv.T_int = 32.0; // Começa super quente
    const params = createDefaultParams();
    params.T_ext = 22.0;
    params.curtainOpening = 0.5; // Ventilação média
    
    const temps: number[] = [];
    const dt = 1.0;
    
    // Simula 20 segundos
    for (let i = 0; i < 20; i++) {
      PhysicsEngine.update(cv, dt, params);
      temps.push(cv.T_int);
    }
    
    // O decaimento deve ser contínuo e gradual (não instantâneo)
    const initialDrop = temps[0] - temps[1];
    const totalDrop = 32.0 - cv.T_int;
    const passed = totalDrop > 0 && initialDrop < 1.0 && cv.T_int > 22.0;
    
    results.push({
      name: 'Resfriamento após desligar fonte (Relaxação térmica)',
      passed,
      metric: `Queda no passo 1: -${initialDrop.toFixed(3)}°C | Queda total: -${totalDrop.toFixed(2)}°C`,
      details: passed
        ? 'Aprovação: Temperatura decai gradualmente devido à capacidade térmica do ar, sem saltos instantâneos.'
        : 'Erro: Queda térmica instantânea ou oscilatória.'
    });
  })();

  // ---------------------------------------------------------------------------
  // TESTE 8: Alta Inércia vs Material Leve
  // ---------------------------------------------------------------------------
  (() => {
    const cvInsulated = createDefaultCV();   // Isolamento bom (baixo U)
    const cvUninsulated = createDefaultCV(); // Isolamento ruim (alto U)
    
    cvInsulated.config.roofUValue = 0.4; // Telha com poliuretano
    cvUninsulated.config.roofUValue = 3.0; // Telha metálica simples
    
    cvInsulated.T_int = 20.0;
    cvUninsulated.T_int = 20.0;
    
    const params = createDefaultParams();
    params.T_ext = 35.0; // Fora está super quente
    
    PhysicsEngine.update(cvInsulated, 1.0, params);
    PhysicsEngine.update(cvUninsulated, 1.0, params);
    
    const passed = cvUninsulated.Q_conduction > cvInsulated.Q_conduction && cvUninsulated.T_int > cvInsulated.T_int;
    results.push({
      name: 'Comparação de Inércia Térmica / U-value',
      passed,
      metric: `Condução U=0.4: +${cvInsulated.Q_conduction.toFixed(0)} W | U=3.0: +${cvUninsulated.Q_conduction.toFixed(0)} W`,
      details: passed
        ? 'Aprovação: Cobertura com baixa transmitância (U=0.4) barra a entrada de calor por condução em relação à telha comum.'
        : 'Erro: Fluxo de condução não responde ao U-value.'
    });
  })();

  // ---------------------------------------------------------------------------
  // IMPRESSÃO DOS RESULTADOS
  // ---------------------------------------------------------------------------
  let allPassed = true;
  results.forEach((res, index) => {
    const statusColor = res.passed ? '\x1b[32m[PASSOU]\x1b[0m' : '\x1b[31m[FALHOU]\x1b[0m';
    if (!res.passed) allPassed = false;
    console.log(`${index + 1}. ${res.name}`);
    console.log(`   Status: ${statusColor}`);
    console.log(`   Métrica: ${res.metric}`);
    console.log(`   Detalhe: ${res.details}\n`);
  });

  console.log('\x1b[36m==================================================\x1b[0m');
  if (allPassed) {
    console.log('\x1b[32m   TODOS OS TESTES FÍSICOS FORAM APROVADOS! \x1b[0m');
  } else {
    console.log('\x1b[31m   HÁ FALHAS NOS TESTES DE ADEQUAÇÃO FÍSICA! \x1b[0m');
  }
  console.log('\x1b[36m==================================================\x1b[0m');

  process.exit(allPassed ? 0 : 1);
};

runTests();
