# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

## Simulador de Ambiência Equina — Gêmeo Digital Termodinâmico e Psicrométrico

**POP nº:** 001/2026  
**Versão:** 1.0  
**Data:** Junho/2026  
**Unidade:** Laboratório de Bioclimatologia / Zootecnia de Precisão  
**Elaborado por:** Equipe de Desenvolvimento — Projeto Ambiência Equina

---

## 1. OBJETIVO

Este POP descreve os procedimentos para operação do **Simulador de Ambiência Equina**, um gêmeo digital termodinâmico e psicrométrico de um estábulo equino (galpão de 4 baias). O simulador permite:

- Visualizar em tempo real as condições ambientais internas de um estábulo (temperatura, umidade, fluxo de ar)
- Simular cenários climáticos e construtivos
- Testar estratégias de automação (ventilação mecânica e natural)
- Conectar-se a um Arduino físico para controle bidirecional (hardware-in-the-loop)
- Analisar o conforto térmico dos animais através de indicadores zootécnicos
- Exportar séries temporais de dados para análise externa

---

## 2. PRÉ-REQUISITOS

### 2.1. Hardware

| Componente | Especificação Mínima |
|------------|----------------------|
| Processador | Dual-core 2.0 GHz |
| Memória RAM | 4 GB |
| GPU | Compatível com WebGL (integrada é suficiente) |
| Display | 1366 × 768 pixels ou superior |
| Arduino (opcional) | Placa compatível (Uno, Mega, Nano) com firmware `ProjetoAmbiencia.ino` |

### 2.2. Software

| Software | Versão | Finalidade |
|----------|--------|------------|
| Node.js | ≥ 18.x | Execução do servidor de desenvolvimento |
| Navegador | Chrome ≥ 89, Edge ≥ 89, Opera ≥ 76 | Web Serial API para conexão com Arduino |
| NPM | ≥ 9.x | Gerenciamento de dependências |

### 2.3. Conhecimentos Recomendados

- Noções básicas de bioclimatologia animal (índices de conforto térmico)
- Familiaridade com interface web e controles deslizantes
- (Opcional) Conhecimento básico de Arduino IDE para upload do firmware

---

## 3. INSTALAÇÃO

### 3.1. Obter o Projeto

Clone o repositório ou copie a pasta do projeto para seu computador.

### 3.2. Instalar Dependências

Abra o terminal na pasta raiz do projeto e execute:

```bash
npm install
```

Este comando instalará:
- **Three.js** (r160) — Motor de renderização 3D
- **GSAP** (3.12.5) — Animações de interface
- **TypeScript** (5.3.3) — Linguagem de desenvolvimento
- **Vite** (5.0.12) — Servidor de desenvolvimento e bundler

### 3.3. Iniciar o Servidor

```bash
npm run dev
```

O servidor será iniciado em `http://localhost:5173` (ou próxima porta disponível). Acesse este endereço no navegador.

---

## 4. INTERFACE DO USUÁRIO

### 4.1. Visão Geral da Tela

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Logo + Modo: SIMULAÇÃO + Status Arduino           │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │   HUD         │
│ SIDEBAR  │    CENA 3D (Three.js)           │   Overlay     │
│ (Abas)   │    Estábulo, Cavalos,           │   (botões     │
│          │    Partículas, Heatmap)          │   flutuantes) │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│  DASHBOARD INFERIOR: Conforto, Balanço Energético, Gráficos │
└─────────────────────────────────────────────────────────────┘
```

### 4.2. Barra Superior (Header)

- **Título:** "AMBIÊNCIA EQUINA — Gêmeo Digital Termodinâmico & Psicrométrico"
- **Modo atual:** SIMULAÇÃO, CONTROLE AUTOMÁTICO ou ARDUINO
- **Status Arduino:** Indicador visual de conexão (verde = conectado, vermelho = desconectado)

### 4.3. Painel Lateral (Sidebar)

Organizado em 5 abas navegáveis:

#### Aba 1 — FÍSICA
Controles para cenário e clima:
- **Presets de Cenário:** Tradicional (Quente), Premium (Isolado), Onda de Calor Crítica
- **Clima Externo:** Temperatura (15–40 °C), Umidade Relativa (20–95%), Radiação Solar (0–1000 W/m²)
- **Geração Interna:** Número de Cavalos (0–4), Atividade Metabólica (Repouso/Alimentação/Estressado), Umidade da Cama (0–100%)

#### Aba 2 — VENTILAÇÃO
- **Controle por Histerese:** Ativa/desativa controle automático (liga exaustores ≥ 28 °C, desliga ≤ 25 °C)
- **Exaustor:** Ajuste de vazão (0–6000 m³/h)
- **Ventilação Natural:** Abertura de Cortinas (0–100%)
- **Escala Térmica:** Legenda de cores (azul = frio, verde = conforto, vermelho = calor)

#### Aba 3 — CONSTRUÇÃO
- **Preset Construtivo:** Tradicional (quente, telhado aberto com lanternim) ou Premium (isolado, teto plano selado)
- **Isolamento do Telhado:** Valor-U (0.4–3.5 W/m²K)
- **Sombreamento:** 0–100%
- **Dimensões:** 12 m × 8 m × 4.5 m (432 m³)

#### Aba 4 — ARDUINO IoT
- **Modo do Controlador:** Desativado, Mock (virtual), Hardware (físico)
- **Conexão Serial:** Botão para conectar ao Arduino via Web Serial
- **Console Serial:** Monitor de mensagens do protocolo bidirecional

#### Aba 5 — DEBUG FILTRO
- **Gráficos de Filtro:** Comparação em tempo real dos valores Real, Medido (com ruído) e Filtrado (EMA) para temperatura e umidade
- **Exportar CSV:** Botão para baixar histórico de dados

### 4.4. HUD Overlay (Canto Superior Direito)

| Botão | Função | Atalho |
|-------|--------|--------|
| 🧮 | Exibir/Ocultar painel de fórmulas | — |
| 💨 | Exibir/Ocultar partículas de fluxo de ar | — |
| 🔥 | Exibir/Ocultar campo térmico (heatmap) | — |
| 📦 | Exibir/Ocultar volume de controle (fronteira) | — |
| ⏸/▶ | Pausar/Retomar simulação | — |
| 🔄 | Resetar simulação | — |
| Escala Tempo | Acelerador temporal (1× a 120×) | — |

### 4.5. Dashboard Inferior

Três colunas de indicadores em tempo real:

1. **Conforto Térmico Equino:**
   - Índice equino (T°F + UR%)
   - Classificação: Confortável, Alerta, Estresse Grave
   - Dica de bem-estar (texto contextual)

2. **Balanço de Energia Sensível:**
   - Geração Metabólica (animais) — em Watts
   - Carga Solar (cobertura) — em Watts
   - Condução pela Envoltória — em Watts
   - Ventilação / Troca de Ar — em Watts
   - Fluxo Líquido (dU/dt) — indicador de aquecimento/resfriamento

3. **Gráficos:**
   - Temperatura Interna vs Externa (°C)
   - Umidade Relativa Interna vs Externa (%)

---

## 5. PROCEDIMENTOS OPERACIONAIS

### 5.1. Iniciar Simulação

1. Certifique-se de que o servidor está rodando (`npm run dev`)
2. Acesse `http://localhost:5173` no navegador
3. A simulação inicia automaticamente com valores padrão (28 °C externo, 65% UR, 4 cavalos em repouso)
4. A cena 3D exibirá o estábulo com os cavalos e partículas de ar

### 5.2. Carregar Presets de Cenário

**Cenário Tradicional (Quente):**
- Clique em "Tradicional (Quente)"
- Temperatura externa: 33 °C | UR: 70% | Radiação: 800 W/m²
- Telhado metálico sem isolamento (U-Value: 3.5)
- Simula estábulo convencional com alto ganho térmico

**Cenário Premium (Isolado):**
- Clique em "Premium (Isolado)"
- Temperatura externa: 26 °C | UR: 50% | Radiação: 250 W/m²
- Telhado com isolamento (U-Value: 0.45) e 90% de sombreamento
- Simula estábulo com boas práticas construtivas

**Cenário Crítico (Onda de Calor):**
- Clique em "Onda de Calor Crítica"
- Temperatura externa: 39 °C | UR: 75% | Radiação: 950 W/m²
- Situação de estresse térmico severo para os animais

### 5.3. Ajustar Parâmetros Manualmente

1. Na aba **FÍSICA**, ajuste os sliders de clima externo
2. No seletor "Atividade Metabólica", escolha o nível dos animais
3. Ajuste a "Umidade da Cama" para simular condições de higiene
4. Na aba **CONSTRUÇÃO**, ajuste isolamento e sombreamento
5. Os efeitos são refletidos em tempo real na cena 3D e no dashboard

### 5.4. Ativar Controle Automático

1. Na aba **VENTILAÇÃO**, ative a chave "Controle por Histerese"
2. O sistema passa a controlar os exaustores automaticamente:
   - **Liga** quando temperatura ≥ 28 °C
   - **Desliga** quando temperatura ≤ 25 °C
3. A abertura das cortinas também é sugerida automaticamente
4. O dashboard exibe "Modo: AUTO" e o indicador de controle muda

### 5.5. Conectar Arduino Físico (Hardware-in-the-Loop)

1. Carregue o firmware `ProjetoAmbiencia.ino` na placa Arduino usando a Arduino IDE
2. Conecte a placa ao computador via USB
3. No simulador, aba **ARDUINO IoT**:
   - Selecione "Arduino Físico (Serial)" no modo do controlador
   - Clique em "CONECTAR ARDUINO SERIAL"
   - Selecione a porta COM correspondente na janela do navegador
4. Após conectado, o Arduino envia heartbeat a cada 2 segundos
5. O simulador envia dados ambientais ao Arduino, que pode comandar os atuadores
6. O console serial exibe as mensagens do protocolo bidirecional

### 5.6. Usar Arduino Mock (Virtual)

1. Na aba **ARDUINO IoT**, selecione "Virtual Arduino (Mock)"
2. Clique em "CONECTAR ARDUINO SERIAL"
3. O simulador passa a executar internamente a mesma lógica de histerese do firmware
4. Indicado para testes sem hardware físico

### 5.7. Exportar Dados (CSV)

1. Na aba **DEBUG FILTRO**, clique em "EXPORTAR SÉRIE TEMPORAL (CSV)"
2. O navegador baixará um arquivo CSV com nome `telemetria_equino_[timestamp].csv`
3. O arquivo contém as colunas:
   - `Timestamp` — Data/hora ISO 8601
   - `T_Real_C` — Temperatura real do modelo físico (°C)
   - `T_Medido_C` — Temperatura com ruído de sensor (°C)
   - `T_Filtrado_C` — Temperatura após filtro EMA (°C)
   - `RH_Real_Percent` — Umidade relativa real (%)
   - `RH_Medido_Percent` — Umidade relativa com ruído (%)
   - `RH_Filtrado_Percent` — Umidade relativa após filtro (%)
   - `Potencia_Atuadores_W` — Consumo dos atuadores (W)
   - `Estado_Ventiladores` — Estado atual dos exaustores

### 5.8. Interpretar Indicadores de Conforto

O simulador utiliza o **Índice Equino** (Temperatura em °F + Umidade Relativa em %):

| Faixa | Classificação | Significado |
|-------|---------------|-------------|
| < 130 | ✅ Confortável | Mecanismos de dissipação funcionam sem sobrecarga |
| 130–150 | ⚠️ Alerta | Necessário monitorar consumo de água dos animais |
| > 150 | 🚨 Estresse Grave | Perigo de insolação — ação corretiva urgente |

### 5.9. Ferramentas de Visualização

**Ativar/Desativar Overlays (botões HUD):**
1. 💨 **Partículas:** Exibe fluxo de ar como partículas animadas na cena 3D
2. 🔥 **Mapa Térmico:** Mostra distribuição de temperatura como overlay colorido
3. 📦 **Volume de Controle:** Exibe as fronteiras do volume de controle termodinâmico
4. 🧮 **Fórmulas:** Abre painel com equações físicas ativas no momento

**Navegação na Cena 3D:**
- **Rotacionar:** Clique e arraste com o botão esquerdo do mouse
- **Zoom:** Role o scroll do mouse
- **Pan:** Clique e arraste com o botão direito do mouse

---

## 6. MODELO FÍSICO — FUNDAMENTOS

### 6.1. Equação do Balanço Térmico

```
dT/dt = (Q_solar + Q_metabólico + Q_condução + Q_ventilação) / (m_ar × cp × 1000)
```

Onde:
- **Q_solar**: Ganho por radiação solar na cobertura (W)
- **Q_metabólico**: Calor sensível gerado pelos animais (W)
- **Q_condução**: Troca por condução através de paredes e telhado (W)
- **Q_ventilação**: Troca de calor sensível pela renovação de ar (W)
- **m_ar**: Massa de ar no volume de controle (kg)
- **cp**: Calor específico do ar (kJ/kg·K)

### 6.2. Balanço de Umidade

```
dw/dt = (Geração de vapor − Remoção por ventilação) / m_ar
```

### 6.3. Componentes de Ventilação

O simulador modela 4 componentes de fluxo de ar:
- **Mecânica:** Exaustores (vazão ajustável 0–6000 m³/h)
- **Efeito Chaminé (Stack Effect):** Ventilação natural por diferença de temperatura
- **Cortinas:** Ventilação transversal por ação do vento
- **Infiltração:** Renovação passiva por frestas e aberturas

---

## 7. SEGURANÇA E BOAS PRÁTICAS

### 7.1. Recomendações de Uso

- Não execute múltiplas instâncias simultâneas do simulador na mesma máquina
- Para uso com Arduino físico, utilize cabos USB blindados e de boa qualidade
- Mantenha o navegador atualizado para garantir compatibilidade com Web Serial API
- Realize backup dos dados exportados (CSV) regularmente

### 7.2. Limitações Conhecidas

- O modelo físico é 0D (uma zona única) — não simula gradientes verticais ou horizontais
- Web Serial API requer conexão HTTPS ou localhost
- Não compatível com Firefox ou Safari para conexão com Arduino físico
- O ruído de sensor simula DHT11 (±0.5 °C, ±2% UR) — outros sensores podem ter precisão diferente

### 7.3. Troubleshooting

| Problema | Causa Provável | Solução |
|----------|----------------|---------|
| Simulação não inicia | Dependências não instaladas | Execute `npm install` |
| Tela branca | Erro no servidor Vite | Verifique o terminal por erros |
| Arduino não conecta | Porta ocupada ou permissão | Feche outras aplicações seriais, recarregue a página |
| Web Serial não aparece | Navegador incompatível | Use Chrome, Edge ou Opera |
| Gráficos não aparecem | Canvas não suportado | Atualize o navegador |
| Cena 3D lenta | GPU sobrecarregada | Reduza a escala de tempo, desligue overlays desnecessários |

---

## 8. MANUTENÇÃO

### 8.1. Atualização do Projeto

```bash
git pull origin main   # Atualizar código
npm install            # Atualizar dependências
```

### 8.2. Build para Produção

```bash
npm run build
```

Gera os arquivos estáticos na pasta `dist/`, prontos para deploy em servidor web.

---

## 9. REFERÊNCIAS

- **Psychrometrics — ASHRAE Handbook of Fundamentals**
- **Equine Comfort Index — Rivas & Besch (1990)**
- **Three.js Documentation** — https://threejs.org/docs/
- **Web Serial API Specification** — https://wicg.github.io/serial/

---

## 10. HISTÓRICO DE REVISÕES

| Versão | Data | Responsável | Descrição |
|--------|------|-------------|-----------|
| 1.0 | Jun/2026 | Equipe Ambiência Equina | Versão inicial do POP |

---

**Elaborado por:** Equipe de Desenvolvimento — Projeto Ambiência Equina  
**Aprovado por:** _________________________________  
**Data da próxima revisão:** Dezembro/2026
