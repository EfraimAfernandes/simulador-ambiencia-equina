# ESTRUTURA E TECNOLOGIA DO SIMULADOR DE AMBIÊNCIA EQUINA

## Gêmeo Digital Termodinâmico e Psicrométrico para Estábulo Equino

**Versão:** 1.0  
**Data:** Junho/2026  
**Stack:** TypeScript + Three.js + Vite + Web Serial API

---

## 1. VISÃO GERAL DA ARQUITETURA

O simulador é uma **aplicação web single-page (SPA)** construída em TypeScript, organizada em **cinco núcleos** interconectados que operam em ciclo contínuo:

```
┌──────────────────────────────────────────────────────────────────┐
│                        APP (Orquestrador)                        │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  FÍSICO   │  │ ZOOTÉCNICO │  │AUTOMAÇÃO │  │   VISUAL     │  │
│  │  (Núcleo  │──│  (Núcleo   │──│  (Núcleo  │──│   (Núcleo    │  │
│  │Simulação) │  │Conforto)   │  │Controle)  │  │Renderização) │  │
│  └────┬─────┘  └─────┬──────┘  └─────┬────┘  └──────┬───────┘  │
│       │              │               │              │           │
│       └──────────────┴───────────────┴──────────────┘           │
│                            │                                     │
│                    ┌───────▼────────┐                            │
│                    │  STORE REATIVO │                            │
│                    │ (DigitalTwin   │                            │
│                    │   Store)       │                            │
│                    └────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1. Princípios Arquiteturais

- **Separação por camadas de processamento:** Valor Real (física) → Medido (ruído sensor) → Filtrado (EMA) → Exibido (UI)
- **Store reativo central:** Padrão Observer com notificações parciais e batch
- **Separação do loop de simulação do loop de renderização:** Passo fixo de física vs `requestAnimationFrame` para 3D
- **Inversão de dependência:** A automação não conhece a UI, apenas o store
- **Protocolo de comunicação padronizado:** Mensagens tipadas para troca simulador ↔ Arduino

---

## 2. STACK TECNOLÓGICA

| Tecnologia | Versão | Finalidade |
|------------|--------|------------|
| **TypeScript** | 5.3.5 | Linguagem principal — strict mode, ES2022 |
| **Three.js** | ^0.160.0 | Renderização 3D com WebGL |
| **GSAP** | ^3.12.5 | Animações de interface e transições suaves |
| **Vite** | ^5.0.12 | Servidor de desenvolvimento e bundler (ESBuild + Rollup) |
| **Web Serial API** | Navegador | Conexão serial com Arduino (padrão W3C) |
| **Canvas 2D API** | Navegador | Gráficos de linha em tempo real (dashboard) |
| **CSS3** | — | Estilização com glassmorphism e variáveis CSS |

### 2.1. TypeScript — Strict Mode

O projeto utiliza TypeScript em modo estrito com as seguintes flags:
- `strict: true` — Checagens rigorosas de tipo
- `noUnusedLocals: true` — Erro para variáveis locais não utilizadas
- `noUnusedParameters: true` — Erro para parâmetros não utilizados
- `noImplicitReturns: true` — Exige retorno explícito em todas as funções
- `noFallthroughCasesInSwitch: true` — Evita fallthrough acidental em switch
- `target: ES2022` — Compilação para JavaScript moderno
- `module: ESNext` — Módulos ES nativos

### 2.2. Three.js — Renderização 3D

Componentes principais do Three.js utilizados:

| Componente | Uso |
|------------|-----|
| `Scene`, `PerspectiveCamera`, `WebGLRenderer` | Núcleo de renderização |
| `OrbitControls` | Navegação do usuário (rotacionar, zoom, pan) |
| `DirectionalLight`, `AmbientLight` | Iluminação dinâmica (simulação solar) |
| `MeshStandardMaterial`, `MeshBasicMaterial` | Materiais dos objetos 3D |
| `BufferGeometry`, `CylinderGeometry`, `PlaneGeometry` | Geometrias dos objetos |
| `Points`, `PointsMaterial` | Sistema de partículas de fluxo de ar |
| `PCFSoftShadowMap` | Sombras suaves na cena |
| `ACESFilmicToneMapping` | Mapeamento de tom cinematográfico |
| `FogExp2` | Névoa atmosférica para profundidade |
| `Quaternion` | Alinhamento de raios solares volumétricos |

### 2.3. Vite — Desenvolvimento e Build

- **Dev server:** Hot Module Replacement (HMR) para desenvolvimento rápido
- **Build:** ESBuild para transpilação + Rollup para bundling
- **TypeScript:** Suporte nativo sem necessidade de `tsc` separado em dev

---

## 3. ESTRUTURA DE DIRETÓRIOS

```
ProjetoAmbiencia/
│
├── index.html                  # Ponto de entrada HTML
├── package.json                # Dependências e scripts
├── tsconfig.json               # Configuração TypeScript
│
├── scripts/
│   ├── test-control-logic.ts   # Teste da lógica de controle
│   └── test-physics.ts         # Teste do motor físico
│
├── src/
│   │
│   ├── app.ts                  # ORQUESTRADOR PRINCIPAL
│   │                           # Ciclo: entrada → decisão → atuação →
│   │                           # simulação → sensoriamento → alarmes →
│   │                           # store → visualização → telemetria
│   │
│   ├── style.css               # Estilos globais (glassmorphism, temas)
│   │
│   ├── domain/                 # DOMÍNIO CIENTÍFICO
│   │   └── climate/
│   │       └── psychrometrics.ts   # Funções psicrométricas (Tetens,
│   │                               # THI, Índice Equino, entalpia)
│   │
│   ├── sim/                    # NÚCLEO DE SIMULAÇÃO FÍSICA
│   │   ├── state/
│   │   │   ├── control-volume.ts   # Volume de Controle (CV) —
│   │   │   │                       # estado termodinâmico + métricas
│   │   │   └── global-state.ts     # Store reativo (DigitalTwinStore)
│   │   │                           # + tipos de estado global
│   │   ├── systems/
│   │   │   └── physics-engine.ts   # Motor físico: balanço de energia,
│   │   │                           # balanço de massa, integração Euler
│   │   ├── ventilation-response.ts # Modelo multicomponente de ventilação
│   │   │                           # (mecânica, stack, cortinas, infiltração)
│   │   └── moisture-response.ts    # Balanço de umidade (animais,
│   │                               # cama, bebedouros, ventilação)
│   │
│   ├── automation/             # NÚCLEO DE AUTOMAÇÃO
│   │   ├── fan-controller.ts       # Controlador individual de ventilador
│   │   │                           # (rampa, estados, consumo energético)
│   │   └── control-rules.ts        # Motor de regras (histerese de
│   │                               # temperatura e umidade, cortinas)
│   │
│   ├── hal/                    # HARDWARE ABSTRACTION LAYER
│   │   ├── iot-manager.ts          # Orquestrador IoT (mock ou hardware)
│   │   ├── iot-factory.ts          # Factory para criar interface Arduino
│   │   ├── arduino-interface.ts    # Interface abstrata do Arduino
│   │   ├── arduino-mock.ts         # Mock do Arduino em TypeScript
│   │   ├── canonical-message.ts    # Mensagens canônicas do protocolo
│   │   ├── sensor-data-builder.ts  # Construtor de mensagens de sensores
│   │   └── protocol-parser.ts      # Parse do protocolo compacto
│   │
│   ├── iot/                    # PROTOCOLO IoT E COMUNICAÇÃO SERIAL
│   │   ├── message-schema.ts       # Schema completo de mensagens,
│   │   │                           # tipos e factories
│   │   ├── web-serial-bridge.ts    # Bridge Web Serial — comunicação
│   │   │                           # bidirecional com Arduino físico
│   │   ├── arduino-bridge.ts       # Bridge legada do firmware antigo
│   │   └── device-registry.ts      # Registro de dispositivos IoT
│   │
│   ├── render/                 # NÚCLEO DE RENDERIZAÇÃO 3D
│   │   ├── scene-manager.ts        # Gerenciador da cena Three.js
│   │   │                           # (câmera, luzes, sombras, raios solares)
│   │   ├── facility/
│   │   │   └── barn-geometry.ts    # Geometria 3D do estábulo (paredes,
│   │   │                           # telhado, cortinas, baias)
│   │   ├── horses/
│   │   │   └── horse-renderer.ts   # Renderização dos cavalos (reações
│   │   │                           # ao ambiente: ofegante, suando)
│   │   ├── objects/
│   │   │   └── fans.ts             # Modelo 3D dos exaustores (hélices
│   │   │                           # girando conforme RPM)
│   │   ├── overlays/
│   │   │   ├── particle-system.ts  # Sistema de partículas de fluxo de ar
│   │   │   └── heatmap-renderer.ts # Mapa térmico (heatmap) do piso
│   │   └── effects/
│   │       ├── airflow-overlay.ts      # Vetores de fluxo de ar (setas 3D)
│   │       └── thermal-surface-overlay.ts # Cores falsas de temperatura
│   │                                     # nas superfícies
│   │
│   ├── ui/                     # INTERFACE DO USUÁRIO
│   │   ├── ui-controller.ts        # Controlador principal da UI
│   │   │                           # (sliders, botões, abas, dashboard)
│   │   ├── charts/
│   │   │   └── chart-manager.ts    # Gerenciador de gráficos Canvas
│   │   │                           # (temperatura, umidade, debug)
│   │   └── panels/
│   │       ├── automation-panel.ts     # Painel de automação
│   │       ├── sensor-health-panel.ts  # Painel de saúde dos sensores
│   │       └── fan-status-panel.ts     # Painel de status dos ventiladores
│   │
│   └── analytics/              # ANÁLISE E LOGS
│       ├── command-log.ts          # Log centralizado de comandos
│       └── alarm-log.ts            # Log de alarmes operacionais
│
├── ProjetoAmbiencia.ino        # Firmware Arduino (C++)
└── [outros arquivos da raiz conforme necessário]
```

---

## 4. DESCRIÇÃO DETALHADA DOS MÓDULOS

### 4.1. `src/app.ts` — Orquestrador Principal

Classe `App` responsável por:

1. **Instanciar e conectar os cinco núcleos** (físico, zootécnico, automação, visual, IoT)
2. **Manter o ciclo completo** por frame de animação:
   ```
   1. Ler entradas (UI + Arduino)
   2. Executar decisão de automação
   3. Aplicar dinâmica de atuadores
   4. Executar simulação física
   5. Aplicar ruído de sensor e filtro
   6. Verificar alarmes
   7. Sincronizar store reativo
   8. Atualizar visualização 3D
   9. Registrar telemetria histórica
   ```
3. **Separar sim loop (passo fixo) de render loop** (`requestAnimationFrame`)
4. **Gerenciar presets de cenário** (Tradicional, Premium, Crítico)
5. **Exportar dados CSV** do histórico de telemetria

### 4.2. `src/sim/` — Núcleo de Simulação Física

#### `control-volume.ts` — Volume de Controle (CV)

Classe que representa o estado termodinâmico do galpão:

- **Configuração geométrica:** Comprimento (12 m), largura (8 m), altura (4.5 m)
- **Propriedades construtivas:** U-Value do telhado, U-Value das paredes, fator de sombreamento
- **Estado termodinâmico:** Temperatura interna (`T_int`), razão de umidade (`w_int`), umidade relativa (`RH_int`), temperatura da envoltória
- **Três camadas de valores:** Real (física pura), Medido (com ruído gaussiano), Filtrado (EMA)
- **Métricas de balanço energético:** `Q_solar`, `Q_metabolic`, `Q_conduction`, `Q_ventilation`, `m_vapor_gen`
- **Componentes de ventilação:** `ventFlowMechanical`, `ventFlowStack`, `ventFlowCurtain`, `ventFlowInfiltration`, `ventFlowTotal`
- **Métricas acumuladas:** Horas fora de conforto, temperatura de pico, umidade de pico, consumo energético

#### `global-state.ts` — DigitalTwinStore (Store Reativo)

Implementa o **padrão Observer** com:

- **Estado completo** tipado (`DigitalTwinState`) com ~30 campos organizados
- **Updates parciais** com notificação seletiva de subscribers
- **Batching** para agrupar múltiplas atualizações por tick
- **Métodos helpers:** `logCommand()`, `addAlarm()`, `addTelemetryEvent()`, `addEnergyConsumption()`
- **Suporte a multizona** preparado (`ZoneState[]`) para expansão futura

#### `systems/physics-engine.ts` — PhysicsEngine

Motor de simulação com:

- **Equação de balanço térmico:** `dT/dt = (Q_solar + Q_met + Q_cond + Q_vent) / (m_ar × cp × 1000)`
- **Equação de balanço de umidade:** `dw/dt = netMoistureFlow / m_ar`
- **Integração numérica:** Euler com sub-stepping adaptativo (até 100 sub-passos para estabilidade)
- **Modelo de envoltória com inércia térmica:** A temperatura da envoltória (`T_envelope`) segue a externa com atraso, e afeta a condução
- **Dois presets estruturais:** "traditional" (alta infiltração, alto ganho solar) vs "premium" (vedado, baixo ganho solar)
- **Coeficientes calibrados** para resposta realista de temperatura e umidade

#### `ventilation-response.ts` — Modelo de Ventilação

Calcula a ventilação multicomponente:

- **Ventilação mecânica:** Fluxo forçado por exaustores (m³/h)
- **Efeito chaminé (stack effect):** Ventilação natural por diferença de densidade térmica
- **Ventilação por cortinas:** Fluxo transversal gerado pelo vento externo
- **Infiltração:** Renovação passiva por frestas (baseada no preset estrutural)
- **Retorno:** Vazão total, ACH (trocas/hora), velocidade média do ar, remoção de calor sensível

#### `moisture-response.ts` — Balanço de Umidade

Calcula a geração e remoção de vapor:

- **Geração animal:** Calor sensível e latente por cavalo (3 níveis de atividade)
- **Evaporação da cama:** Função da umidade da cama e velocidade do ar
- **Evaporação de bebedouros:** Área superficial e temperatura da água
- **Remoção por ventilação:** Baseada na diferença de razão de umidade interna/externa
- **Retorno:** Geração total de vapor, calor sensível animal, acúmulo líquido de umidade

### 4.3. `src/automation/` — Núcleo de Automação

#### `fan-controller.ts` — Controlador de Ventiladores

Modela a dinâmica realista de cada ventilador:

- **Máquina de estados:** `off → starting → running → stopping → off` (mais `fault`)
- **Curva de partida:** Rampa linear de `rampUpTime` segundos (padrão: 8 s)
- **Curva de parada:** Rampa linear de `rampDownTime` segundos (padrão: 5 s)
- **Suavização hermite:** `smoothstep(t) = t² × (3 - 2t)` para transições naturais
- **Consumo energético:** Proporcional ao quadrado do RPM relativo (lei de afinidade simplificada)
- **Vazão:** Proporcional ao RPM (1ª lei de afinidade)
- **Acumulação de horas de operação**
- **Simulação de falhas:** Estado `fault` com desaceleração de emergência

#### `control-rules.ts` — Motor de Regras

Implementa a lógica de automação:

- **Histerese de temperatura:** Liga ≥ 28 °C, desliga ≤ 25 °C (evita oscilação)
- **Histerese de umidade:** Ativa ventilação extra se UR ≥ 80% (segurança sanitária)
- **Controle inteligente de cortinas:** Abertura proporcional à temperatura
- **Alertas sanitários:** Mensagens contextuais para o operador
- **Retorno:** Decisão de controle + logs de ações

### 4.4. `src/hal/` — Hardware Abstraction Layer (IoT)

#### `iot-manager.ts` — Orquestrador IoT

Gerencia a comunicação com o controlador (mock ou hardware):

- **Modos:** `none` (desativado), `mock` (virtual), `hardware` (físico)
- **Ciclo de vida:** `setMode()` → `connect()` → `tick()` → `disconnect()`
- **Envio periódico de sensores** a cada 2 segundos
- **Callbacks:** Comandos recebidos, mensagens legadas, logs
- **Estado dos atuadores** sincronizado com o controlador

#### `arduino-mock.ts` — Simulador de Arduino

Implementa a mesma lógica de controle do firmware em TypeScript:
- Histerese de temperatura com bandas configuráveis
- Comandos de atuadores (ventiladores, bomba de nebulização)
- Heartbeat simulado
- Falhas de sensor simuladas

#### `iot-factory.ts` — Factory do Arduino

Padrão **Factory** que cria a interface apropriada:
- `'none'` → `null`
- `'mock'` → `ArduinoMock`
- `'hardware'` → `WebSerialBridge`

### 4.5. `src/iot/` — Protocolo de Comunicação

#### `message-schema.ts` — Schema de Mensagens

Define todo o **protocolo de comunicação bidirecional**:

| Tipo | Direção | Conteúdo |
|------|---------|----------|
| `env_update` | Simulador → Arduino | Temperatura, UR, velocidade do ar, índice de conforto |
| `fan_command` | Arduino → Simulador | ID do ventilador, ação (on/off), velocidade alvo |
| `fan_state` | Arduino → Simulador | RPM, corrente, estado do atuador |
| `heartbeat` | Arduino → Simulador | Uptime, status do sensor |
| `alarm` | Sistema → Log | Tipo, severidade, mensagem, valor, limiar |
| `sensor_fault` | Arduino → Simulador | ID do sensor, tipo de falha |
| `connection_lost` | Sistema → Log | Timestamp do último heartbeat |

#### `web-serial-bridge.ts` — Ponte Web Serial

Implementa a comunicação serial com Arduino físico:
- Conexão via `navigator.serial.requestPort()`
- Leitura/escrita assíncrona com `ReadableStream`/`WritableStream`
- Parse de mensagens no formato compacto (`JSON` ou binário)
- Timeout de heartbeat (10 s)
- Reconexão automática

### 4.6. `src/render/` — Núcleo de Renderização

#### `scene-manager.ts` — Gerenciador de Cena

Configura e gerencia a cena Three.js:

- **Câmera:** Perspectiva 45°, posição (16, 12, 20)
- **Renderizador:** WebGL com antialiasing, shadow map, ACES filmic tone mapping
- **Iluminação dinâmica:** Luz solar direcional que se move conforme a radiação simulada
- **Céu dinâmico:** Background muda do azul claro (dia) → laranja (entardecer) → escuro (noite)
- **Raios solares volumétricos (God Rays):** 8 cilindros translúcidos alinhados com o sol
- **Sistema de sombras:** PCFSoft com resolução 2048×2048
- **Navegação:** OrbitControls com damping

#### `facility/barn-geometry.ts` — Geometria do Estábulo

Modelo 3D completo do galpão:
- Paredes, telhado (com dois presets: lanternim aberto ou teto plano)
- 4 baias individuais com divisórias
- Cortinas laterais animadas (abertura 0–100%)
- Piso com textura de grama
- Volume de controle (opcional, outline)

#### `horses/horse-renderer.ts` — Renderização dos Cavalos

Cavalos 3D com comportamento reativo ao ambiente:
- **Animação de ofego:** Aumenta frequência respiratória em altas temperaturas
- **Sudorese:** Efeito visual (brilho) em condições de estresse térmico
- **Posicionamento:** Distribuição espacial nas baias conforme o número de animais

#### `objects/fans.ts` — Exaustores 3D

Modelo dos exaustores com:
- Hélices girando proporcionalmente ao RPM
- Transição visual entre parado, partindo, rodando e parando
- Efeito de fluxo de ar (opcional)

#### `overlays/` — Overlays Científicos

**`particle-system.ts`:** Sistema de partículas (5000 pontos) representando o fluxo de ar:
- Velocidade e direção influenciadas pelos exaustores, cortinas e convecção natural
- Cor das partículas varia com a temperatura (azul = frio, vermelho = quente)
- Comportamento físico: advecção, turbulência, buoyancy (flutuação térmica)

**`heatmap-renderer.ts`:** Mapa térmico do piso:
- Gradiente de cor baseado na temperatura interna
- Influência da posição dos cavalos (calor metabólico localizado)
- Opacidade ajustável

#### `effects/` — Efeitos de Visualização

**`airflow-overlay.ts`:** Grade de vetores de fluxo de ar (setas 3D):
- Direção e magnitude baseadas no modelo físico
- Útil para visualizar padrões de ventilação

**`thermal-surface-overlay.ts`:** Cores falsas nas superfícies:
- Temperatura das paredes, telhado e piso
- Gradiente de azul (frio) a vermelho (quente)

### 4.7. `src/domain/climate/psychrometrics.ts` — Domínio Científico

Funções psicrométricas fundamentais:

| Função | Descrição |
|--------|-----------|
| `getSatVaporPressure(temp)` | Pressão de vapor de saturação (Tetens: `610.78 × exp(17.27T / (T + 237.3))`) |
| `getHumidityRatio(temp, rh)` | Razão de mistura: `0.622 × Pv / (P_atm - Pv)` |
| `getRelativeHumidity(temp, w)` | Umidade relativa a partir da razão de mistura |
| `getEnthalpy(temp, w)` | Entalpia do ar úmido: `cp_ar × T + w × (2501 + 1.86 × T)` |
| `getThomTHI(temp, rh)` | Índice de Temperatura e Umidade (Thom, 1959) |
| `getEquineComfortIndex(temp, rh)` | Índice específico equino: `T°F + UR%` |

### 4.8. `src/ui/` — Interface do Usuário

#### `ui-controller.ts` — Controlador da UI

Gerencia todos os elementos da interface:
- Sliders de parâmetros climáticos e construtivos
- Abas do painel lateral (5 abas)
- Botões HUD (6 botões flutuantes)
- Dashboard inferior (conforto, energia, gráficos)
- Presets de cenário (3 botões)
- Labels e valores exibidos em tempo real
- Painel de fórmulas (equações ativas)

#### `charts/chart-manager.ts` — Gráficos Canvas

Implementa gráficos de linha em tempo real usando Canvas 2D:
- Suporte a 3 séries simultâneas por gráfico
- Rolagem automática (50 pontos de histórico)
- Escala automática com min/max configuráveis
- Gradientes e anti-aliasing

#### `panels/` — Painéis Diagnósticos

- **`automation-panel.ts`:** Exibe estado atual da automação (setpoints, bandas, decisões)
- **`sensor-health-panel.ts`:** Mostra saúde dos sensores (leituras, falhas, desvio)
- **`fan-status-panel.ts`:** Estado detalhado de cada ventilador (RPM, consumo, horas de operação)

### 4.9. `src/analytics/` — Análise e Logs

- **`command-log.ts`:** Log cronológico de comandos emitidos pelo sistema
- **`alarm-log.ts`:** Registro de alarmes com severidade, mensagem e reconhecimento

---

## 5. FLUXO DE DADOS — CICLO POR FRAME

O método `animate()` em `app.ts` executa o seguinte ciclo a cada `requestAnimationFrame`:

```
┌───────────────────────────────────────────────────────────────────┐
│                        requestAnimationFrame                      │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  1. Ler parâmetros da UI (sliders, toggles, seletores)           │
│     → `ui.getPhysicsParams()`                                     │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  2. Se não pausado:                                               │
│     a. Decisão de automação (controle manual/automático/Arduino)  │
│     b. Dinâmica dos ventiladores (rampa off→starting→running)    │
│     c. Simulação física (PhysicsEngine.update — Euler sub-       │
│        stepped: balanço térmico + balanço de umidade +           │
│        ventilação multicomponente)                               │
│     d. Ruído de sensor (Box-Muller, σ = 0.5°C / 2% UR)          │
│     e. Filtro EMA (α = 0.15)                                     │
│     f. Telemetria ao controlador IoT (a cada 2s)                 │
│     g. Métricas acumuladas (horas fora de conforto, picos)       │
│     h. Verificação de alarmes (estresse térmico, timeout)        │
│     i. Sincronização do store reativo                             │
│     j. Atualização dos gráficos (a cada 600ms)                   │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  3. Atualização visual (sempre, mesmo pausado):                   │
│     a. Iluminação solar (cor, intensidade, posição)              │
│     b. Geometria do estábulo (cortinas animadas)                 │
│     c. Ventiladores 3D (hélices conforme RPM)                    │
│     d. Cavalos (reações ao ambiente)                             │
│     e. Partículas de ar (advecção, turbulência, buoyancy)        │
│     f. Overlay de fluxo de ar (setas 3D)                        │
│     g. Overlay térmico de superfícies                           │
│     h. Heatmap do piso                                           │
│     i. Dashboard (conforto, energia, rótulos)                   │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  4. Renderizar cena Three.js (sceneManager.render)                │
└───────────────────────────────────────────────────────────────────┘
```

---

## 6. MODELO FÍSICO — FORMULAÇÃO MATEMÁTICA

### 6.1. Balanço de Energia Sensível

```
dT_int/dt = (Q_solar + Q_met + Q_cond + Q_vent) / (m_ar × cp × 1000)

Onde:
  Q_solar  = R_solar × A_telhado × (1 − shading) × U_roof × k_solar
  Q_met    = Calor sensível dos cavalos (dependente da atividade)
  Q_cond   = (U_wall × A_walls + U_roof × A_roof) × (T_envelope − T_int)
  Q_vent   = m_dot_vent × cp × 1000 × (T_int − T_ext)
  m_ar     = V × ρ_ar  (massa de ar no volume de controle)
```

### 6.2. Balanço de Umidade

```
dw_int/dt = (ṁ_vapor − ṁ_vent × (w_int − w_ext)) / m_ar

Onde:
  ṁ_vapor  = Geração total de vapor (cavalos + cama + bebedouros)
  ṁ_vent   = Vazão mássica de ventilação
  w_int    = Razão de umidade interna
  w_ext    = Razão de umidade externa
```

### 6.3. Ventilação Multicomponente

```
Q_total = Q_mecânica + Q_stack + Q_cortinas + Q_infiltração

Onde:
  Q_mecânica    = Vazão dos exaustores (RPM × fator de conversão)
  Q_stack       = f(ΔT, altura) — efeito chaminé
  Q_cortinas    = f(A_abertura, v_wind) — ventilação transversal
  Q_infiltração = ACH_base × V / 3600 — renovação passiva
```

### 6.4. Modelo de Sensor

```
Valor Medido = Valor Real + Ruído Gaussiano (Box-Muller, σ_temp = 0.5, σ_rh = 2.0)

Valor Filtrado (EMA) = α × Medido + (1 − α) × Filtrado_anterior
  α = 0.15 (padrão, suavização moderada)
```

---

## 7. INTEGRAÇÃO COM ARDUINO

### 7.1. Arquitetura de Comunicação

```
┌─────────────────┐         Web Serial API         ┌──────────────────┐
│   SIMULADOR     │ ◄─────── (JSON/Binário) ──────► │    ARDUINO      │
│  (TypeScript)   │                                  │   (C++ / .ino)  │
│                 │  env_update (sensores)           │                 │
│  IoTManager ────┼─────────────────────────────────►│  ControlLogic   │
│                 │                                  │                 │
│  WebSerialBridge│◄─────────────────────────────────┤  fan_command    │
│                 │  heartbeat / fan_state           │  heartbeat      │
└─────────────────┘                                  └──────────────────┘
```

### 7.2. Formatos de Mensagem

**Compacto (JSON):**
```json
{
  "type": "env_update",
  "timestamp": 1718400000000,
  "payload": {
    "tempInternal": 26.3,
    "rhInternal": 72.1,
    "airSpeed": 1.2,
    "comfortIndex": 142,
    "tempExternal": 31.0,
    "rhExternal": 60.0,
    "ventilationRate": 8.5
  }
}
```

**Binário (opcional para firmware embarcado):**
```
[0x01][4 bytes temp][4 bytes rh][2 bytes comfort]...[checksum]
```

---

## 8. PADRÕES DE PROJETO UTILIZADOS

| Padrão | Onde | Descrição |
|--------|------|-----------|
| **Observer** | `DigitalTwinStore` | Módulos subscrevem para receber notificações de mudança de estado |
| **Singleton** | `App` | Instância única do orquestrador principal |
| **Factory** | `iot-factory.ts` | Cria interface Arduino (mock ou hardware) baseada no modo |
| **Strategy** | `ControlRules.evaluate()` | Diferentes algoritmos de controle (histerese, futuro PID) |
| **State** | `FanController` | Máquina de estados do ventilador (off/starting/running/stopping/fault) |
| **Bridge** | `WebSerialBridge` | Abstrai comunicação serial do protocolo de mensagens |
| **Facade** | `IoTManager` | Simplifica interface complexa do sistema IoT |
| **Layered Processing** | CV → Sensor → Filtro → UI | Processamento em camadas com separação explícita |

---

## 9. DEPENDÊNCIAS EXTERNAS

### Produção
| Pacote | Versão | Tamanho (min) | Função |
|--------|--------|---------------|--------|
| `three` | ^0.160.0 | ~600 KB | Renderização 3D WebGL |
| `gsap` | ^3.12.5 | ~40 KB | Animações de interface |

### Desenvolvimento
| Pacote | Versão | Função |
|--------|--------|--------|
| `typescript` | ^5.3.3 | Compilador TypeScript |
| `vite` | ^5.0.12 | Servidor de desenvolvimento e bundler |
| `@types/three` | ^0.160.0 | Tipos TypeScript para Three.js |

---

## 10. EXTENSIBILIDADE E TRABALHOS FUTUROS

O projeto foi arquitetado com pontos de extensão claros:

1. **Multizona:** O store já contém `zoneStates: ZoneState[]` para expansão a múltiplas zonas
2. **Algoritmos de controle:** `ControlRules` pode receber novas estratégias (PID, lógica fuzzy)
3. **Sensores adicionais:** Basta estender `LayeredValues` e adicionar ruído/filtro
4. **Atuadores:** Interface `ActuatorState` permite adicionar nebulizadores, aquecedores, etc.
5. **Modelo CFD:** O sistema de partículas 3D pode ser substituído por simulação CFD acoplada
6. **Banco de dados:** Histórico de telemetria pode ser persistido via IndexedDB ou API REST
7. **Realidade Aumentada:** A cena Three.js pode ser adaptada para WebXR

---

## 11. COMANDOS ÚTEIS

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Visualizar build de produção
npm run preview

# Testar motor físico (linha de comando)
npx tsx scripts/test-physics.ts

# Testar lógica de controle (linha de comando)
npx tsx scripts/test-control-logic.ts
```

---

**Documentação gerada em:** Junho/2026  
**Projeto:** Ambiência Equina — Gêmeo Digital Termodinâmico e Psicrométrico  
**Repositório:** ProjetoAmbiencia
