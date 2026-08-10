# Skill: threejs-farm-science-sim

## Purpose
This skill guides an AI agent to design and scaffold high-level simulations in Three.js with emphasis on farm systems, environmental processes, scientific visualization, and simulation-driven interaction. It is intended for projects that combine real-time 3D worlds with domain logic such as crop growth, soil-water dynamics, irrigation, livestock behavior, weather, field operations, laboratory/experimental overlays, and educational science scenes.

Use this skill when the task involves any of the following:
- Building a farm simulation game or digital twin in Three.js.
- Designing a scientific or educational simulation with spatial processes.
- Architecting large interactive terrains with crops, machinery, water, climate, or ecology.
- Connecting simulation state to rendering, UI, analytics, and scenario playback.
- Planning performance-aware browser simulations with chunking, LOD, and agent systems.

Do not use this skill when the task is only about:
- Basic Three.js scene setup with a cube, camera, and controls.
- Purely cinematic visualization with no meaningful simulation model.
- Small toy demos that do not need domain systems or world-scale architecture.

## Core mindset
Treat the project as **two coupled engines**:
1. A simulation engine that owns truth.
2. A rendering engine that presents visible state.

The simulation must remain valid even if the renderer changes. Rendering should subscribe to state rather than become the source of truth.

Prefer a layered architecture:
- Domain layer: crops, soil, water, weather, livestock, economics, experiments.
- Simulation layer: rules, state transitions, scheduling, stochastic events, time-step logic.
- Spatial layer: fields, chunks, biomes, roads, canals, buildings, sensor networks.
- Rendering layer: terrain meshes, instances, particles, materials, overlays, post-processing.
- Interaction layer: tools, inspectors, build/place workflows, HUD, experiment controls.
- Data layer: save/load, scenario definitions, parameters, telemetry, charts, replay.

## Design goals
Every farm/science simulation should optimize for:
- Spatial clarity: the player/researcher must understand what exists where.
- Process legibility: growth, flow, diffusion, stress, and intervention should be visible.
- Temporal coherence: time acceleration must not break causal reasoning.
- Scientific traceability: parameters, units, assumptions, and uncertainty should be inspectable.
- Performance scaling: large worlds should degrade gracefully through chunking and LOD.
- Extensibility: new species, equipment, experiments, or models should be pluggable.

## Project framing
Start by identifying the project on these axes:

| Axis | Questions |
|---|---|
| Simulation intent | Is this a game, a digital twin, a teaching lab, a planning tool, or a research prototype? |
| Fidelity | Arcade, stylized, agronomic, hydrological, ecological, or hybrid? |
| Time scale | Real time, accelerated day-night, seasonal, event-driven, or batch playback? |
| Space scale | Single greenhouse, farmstead, watershed, region, or modular experiment plot? |
| Primary agents | Crops, farmers, machines, animals, pathogens, water parcels, sensors, or students? |
| Decision loop | Build, monitor, optimize, experiment, diagnose, compare scenarios, or teach concepts? |

The architecture should be derived from those answers before implementation begins.

## Recommended architecture
Use a hybrid of ECS-style runtime data and domain modules.

### World model
Represent the world through composable entities and domain registries:
- Entities: crop patch, tree, animal, vehicle, irrigation line, weather station, soil cell, lab device.
- Components: transform, growth state, moisture, nutrient profile, health, task queue, energy use, ownership, sensor stream.
- Systems: growth update, evapotranspiration, pathfinding, market pricing, disease spread, irrigation scheduling, grazing, harvesting.
- Registries: species catalog, equipment catalog, soil presets, weather presets, experiment protocols.

Prefer **patch-level simulation** over per-plant simulation unless close-up interaction demands plant-level detail. A field may simulate yield, density, moisture, and stress by cells or management zones, while only visible foreground plants receive detailed visual variation.

### Spatial partitioning
Use explicit spatial partitions:
- World > region > chunk > field > management zone > sample cell.
- Keep simulation partitions aligned with render partitions where possible.
- Make every chunk independently loadable, updateable, and serializable.

For farm worlds, useful chunk ownership patterns include:
- Terrain chunk.
- Vegetation instance pools.
- Water graph nodes and channels.
- Static props and buildings.
- Dynamic agents currently inside the chunk.
- Overlay textures such as moisture, fertility, pest pressure, traffic compaction.

### Time model
Use a simulation clock independent from render frames.
- Render loop: variable frame rate.
- Simulation loop: fixed time step.
- Long processes: scheduled events or coarser update cadence.

Recommended pattern:
- `requestAnimationFrame` drives rendering.
- Accumulator drives fixed-step simulation, for example 5–20 updates per in-game hour depending on fidelity.
- Slow systems such as crop phenology, economics, and climate summaries may update at larger intervals.

## Farm domain modules
A high-level farm simulation should usually decompose into the following modules.

### Crop system
Model crops by phenotype and management state rather than only mesh appearance.

Minimum state:
- Species/cultivar.
- Sowing date and growth stage.
- Thermal time or stage progression.
- Biomass/yield potential.
- Water and nutrient stress.
- Plant density.
- Health/disease pressure.
- Harvest readiness.

Useful abstractions:
- Growth curves driven by degree days.
- Visual state bands mapped to shader parameters or instanced variations.
- Management events: planting, thinning, fertilizing, spraying, irrigating, harvesting.

### Soil and water
Represent soil as layered or gridded state, depending on scope.

Possible variables:
- Volumetric water content.
- Infiltration capacity.
- Field capacity and wilting point.
- Texture class.
- Organic matter.
- Nitrogen/phosphorus/potassium pools.
- Temperature and salinity.
- Compaction.

Useful model choices:
- Cell-based moisture balance for gameplay clarity.
- Simplified bucket models for broad farm-scale simulation.
- Graph or raster flow for irrigation channels and runoff.
- Visual overlays for moisture, erosion risk, and nutrient distribution.

### Weather and microclimate
Weather should not be cosmetic only.

Model:
- Solar radiation.
- Temperature.
- Relative humidity.
- Wind.
- Rainfall.
- Reference evapotranspiration or simplified water demand.
- Extreme events such as frost, heat stress, hail, or drought.

Expose weather to:
- Crop growth.
- Soil evaporation.
- Spray drift rules.
- Livestock comfort.
- Water reservoir balance.
- Visual atmosphere, fog, clouds, and material wetness.

### Animals and livestock
For animal systems, simulate at herd/group level first unless individual behavior is central.

Core dimensions:
- Location and enclosure.
- Intake and water demand.
- Health/stress.
- Reproduction or production metrics.
- Waste generation.
- Social movement rules.

Use state machines for common behavior loops:
- Graze -> drink -> rest -> move.
- Feed -> wait -> milk/check -> rest.

### Machines and operations
Farm simulations become more convincing when operations are explicit entities.

Represent:
- Implements and vehicles.
- Fuel/energy.
- Working width.
- Speed.
- Task assignment.
- Soil impact.
- Maintenance.

Operations should write back to world state:
- Seeding changes crop patches.
- Irrigation changes moisture.
- Tractor traffic changes compaction.
- Spraying changes disease pressure and residue.
- Harvesting changes biomass, inventory, and residue cover.

### Economics and logistics
Even scientific simulations benefit from a resource/accounting layer.

Track:
- Inputs.
- Labor.
- Energy.
- Water use.
- Inventory.
- Yield.
- Waste.
- Scenario cost.
- Experimental metrics.

## Science modules
Use these patterns when the project leans toward science or teaching rather than only gameplay.

### Experimental design
Support multiple scenarios with shared baseline conditions:
- Control vs treatment.
- Irrigation levels.
- Fertilizer levels.
- Cultivar comparison.
- Stocking density.
- Soil amendment.
- Pathogen exposure.

Make scenario parameters explicit and exportable.

### Units and provenance
Every scientific variable should define:
- Name.
- Symbol.
- Unit.
- Valid range.
- Source or assumption.
- Visualization mapping.

Do not hide important assumptions inside shader constants or arbitrary magic numbers.

### Observability
Add instrumentation from the start:
- Probes.
- Sample plots.
- Transects.
- Sensor time series.
- Layer inspectors.
- Event logs.
- Scenario deltas.

A science-oriented simulation should answer not only “what happened?” but also “why did it happen here and when?”

### Uncertainty and simplification
If a model is simplified, surface that clearly.

Recommended labels:
- Heuristic.
- Empirical approximation.
- Educational simplification.
- Literature-derived parameterization.
- User-calibrated assumption.

## Three.js rendering strategy
Use rendering techniques as views over simulation state rather than ad hoc decoration.

### Terrain
Recommended terrain stack:
- Chunked terrain tiles.
- Heightfield or procedural displacement.
- Splat/weight maps for soil cover, paths, crop beds, puddles.
- Secondary overlay textures for stress, moisture, fertility, contamination, or treatment zones.

Good patterns:
- Keep terrain geometry moderate and push detail into normal maps, decals, and overlays.
- Use separate data textures for scientific layers when the user needs inspectable maps.
- Support contour or false-color views for analysis mode.

### Vegetation and repeated assets
Use instancing aggressively:
- Crops.
- Trees.
- Fence posts.
- Rocks.
- Drip emitters.
- Solar panels.
- Greenhouse supports.

Recommended visual hierarchy:
- Far distance: billboard/impostor or coarse patch representation.
- Mid distance: instanced clumps or low-poly plants.
- Near distance: higher-fidelity instances with wind, color variation, and stage variation.

Do not simulate each visible leaf unless the project is explicitly a close-range botanical study.

### Water, fluids, and environmental effects
Separate physically important water from decorative water.

Examples:
- Irrigation channels may use graph flow logic plus simplified mesh deformation.
- Pond/reservoir level may be simulation-driven and reflected in mesh height.
- Sprinklers may use particles visually while actual water application is computed analytically.
- Runoff may be represented by cell transfer or graph routing rather than full fluid simulation.

### Materials and visual language
Choose one visual mode and stay consistent:
- Stylized readable farm sim.
- Semi-realistic digital twin.
- Scientific false-color analytic mode.
- Classroom explainer mode.

For science-heavy scenes, provide at least two display modes:
- Presentation mode: natural colors and immersive lighting.
- Analysis mode: overlays, legends, isolines, sensor markers, false-color materials.

### Camera and navigation
Farm/science simulations often need more than one camera mode:
- Ground first-person or third-person inspection.
- RTS/orbital planning camera.
- Drone survey view.
- Orthographic analysis view.
- Section/cutaway view for soil or greenhouse systems.

Switching cameras should preserve context and selected entities.

## Interaction design
A strong simulation is inspectable and steerable.

Recommended tools:
- Paint/select field zones.
- Place infrastructure.
- Trigger operations.
- Scrub time.
- Compare scenarios.
- Pin charts.
- Probe any cell/entity.
- Toggle overlays.
- Replay important events.

For science workflows, include:
- Parameter panels with units.
- Scenario cloning.
- Snapshot/export.
- Before/after comparison.
- Layer legends.
- Annotation markers.

## Data flow blueprint
Use an explicit update pipeline.

1. Read user commands, scheduled events, and external inputs.
2. Advance simulation clock with fixed-step updates.
3. Run domain systems in deterministic order.
4. Resolve conflicts, constraints, and aggregate metrics.
5. Update chunk visibility and LOD.
6. Push visible deltas into render buffers, instance matrices, shaders, overlays, and UI.
7. Render world, overlays, and charts.
8. Log telemetry and checkpoint save state when needed.

Keep the simulation graph inspectable. Debug overlays should show which systems ran, what changed, and which assumptions fired.

## Performance policy
Large farm worlds fail when visual density and simulation fidelity grow together without control.

Adopt these rules:
- Simulate coarsely by default, refine only near relevance.
- Use chunk activation around camera, player, drone, or active experiment site.
- Decouple visual density from simulation density.
- Use instancing for repeated assets.
- Use LOD for terrain, vegetation, buildings, and shadows.
- Move expensive preprocessing or analysis to workers when feasible.
- Cache derived maps such as slope, wetness index, irrigation reachability, and fertility classes.
- Prefer aggregate animal/crop groups unless individuality matters.
- Avoid per-frame object creation inside hot loops.
- Instrument CPU, GPU, and memory early.

### Suggested budgets
Use these as planning targets, not absolute limits:
- Main simulation tick should remain deterministic and bounded.
- Chunk ownership should prevent global scans each frame.
- Render updates should be delta-based rather than full rebuilds.
- Overlay textures should update only when source state changes.
- Raycasting should be limited to interaction layers, not the full scene graph.

## Implementation pattern
When asked to scaffold a project, generate structure like this:

```text
src/
  core/
    app.ts
    config.ts
    clock.ts
    event-bus.ts
  sim/
    world-state.ts
    ecs/
    systems/
      crop-system.ts
      soil-water-system.ts
      weather-system.ts
      livestock-system.ts
      economy-system.ts
      operations-system.ts
    models/
    schedulers/
  world/
    chunks/
    terrain/
    fields/
    networks/
      irrigation/
      roads/
      sensors/
  render/
    scene/
    terrain/
    vegetation/
    water/
    materials/
    overlays/
    lod/
  interaction/
    tools/
    selection/
    cameras/
    ui-bindings/
  data/
    scenarios/
    presets/
    telemetry/
    saves/
```

## Agent behavior
When using this skill, the agent should:
- Ask what kind of simulation is intended: game, digital twin, research tool, teaching tool, or hybrid.
- Ask which farm domains matter most: crops, irrigation, livestock, weather, machinery, economics, microbiology, ecology, etc.
- Ask the required scale and fidelity.
- Separate domain model decisions from render decisions.
- Propose chunking, LOD, and state ownership early.
- Recommend fixed-step simulation with render decoupling.
- Prefer data-driven registries for species, machines, materials, and scenarios.
- Make scientific assumptions explicit.
- Include observability and debug tools by default.
- Suggest staged implementation rather than full complexity at once.

## Default planning sequence
When the user asks for a new project, follow this order:
1. Define simulation scope and fidelity.
2. Define world partitioning and time model.
3. Define domain modules and data schemas.
4. Define render representations for each domain object.
5. Define interaction workflows and analysis views.
6. Define performance strategy and budgets.
7. Scaffold project folders and interfaces.
8. Build one vertical slice, for example: field + weather + crop growth + irrigation + overlay.
9. Validate with telemetry and visual debugging.
10. Expand to additional systems only after the first slice is stable.

## Recommended first vertical slices
Strong initial slices include:
- Crop field + soil moisture grid + irrigation + growth overlay.
- Greenhouse bay + climate control + plant trays + sensor charts.
- Pasture paddock + herd movement + forage depletion + water points.
- Watershed edge + rainfall + runoff routing + erosion heatmap.
- Experimental plot matrix + treatment toggles + comparative analytics.

## Common anti-patterns
Avoid these mistakes:
- Putting all logic in the render loop.
- Making mesh state the source of truth.
- Simulating per-plant detail across the entire map from day one.
- Using one global update for every object regardless of relevance.
- Mixing gameplay variables and scientific units without clear mapping.
- Building visuals before defining state schemas.
- Adding realistic shaders before proving simulation clarity.
- Hiding critical parameters inside hardcoded constants.
- Treating weather as a skybox-only feature.
- Ignoring save/load, scenario reproducibility, and telemetry.

## Response templates
Use these response patterns when helping with implementation.

### Architecture answer
- State the recommended domain boundaries.
- Define the simulation clock and update order.
- Define chunk ownership and LOD rules.
- Map domain objects to render representations.
- End with a vertical-slice implementation plan.

### Refactor answer
- Identify current coupling problems.
- Separate simulation state, render state, and UI state.
- Extract systems by domain.
- Introduce instrumentation and debug overlays.
- Propose a migration path with minimal breakage.

### Optimization answer
- Diagnose whether the bottleneck is simulation CPU, render CPU, GPU, memory, or interaction.
- Recommend chunking, instancing, LOD, aggregation, workers, and delta updates as appropriate.
- Preserve scientific interpretability while reducing detail.

### Science answer
- Clarify model purpose and required fidelity.
- Name variables, units, and assumptions explicitly.
- Distinguish empirical heuristics from physically motivated models.
- Recommend visible overlays and parameter inspection.

## Example prompts this skill should handle
- Design the architecture for a Three.js irrigation and crop growth simulator for a Brazilian farm.
- Refactor this farm game so crop logic is decoupled from plant meshes.
- Create a chunked terrain and vegetation strategy for a large-scale agriculture sim.
- Add a scientific analysis mode with false-color moisture overlays and sensor probes.
- Build a greenhouse climate and plant tray simulation with layered time controls.
- Compare patch-based crop simulation versus per-plant simulation for performance and realism.

## Output expectations
When this skill is active, answers should usually include:
- A domain architecture.
- A system decomposition.
- A data model sketch.
- A render strategy.
- A performance strategy.
- A staged implementation roadmap.
- Warnings about fidelity/performance trade-offs.

## Short checklist
Before finalizing any answer, verify:
- Is the simulation goal explicit?
- Is the time model defined?
- Is world partitioning defined?
- Are domain variables separate from mesh state?
- Are scientific assumptions visible?
- Are observability tools included?
- Is performance strategy explicit?
- Is there a recommended first vertical slice?

## One-sentence operating rule
Build the farm/science simulation as a state-driven world model first, then use Three.js as the adaptive visual instrument that reveals, tests, and interacts with that model.

---

# Extensão: instalações de equinos, ambiência e balanço de energia

## Objetivo desta extensão
Esta extensão adapta a skill para um caso mais específico: uma fazenda com instalações para cavalos, em que o ambiente interno da instalação é parte central da simulação. O foco deixa de ser apenas manejo geral da fazenda e passa a incluir ambiência animal, automação predial rural, análise térmica e de massa, e tomada de decisão baseada em princípios da Engenharia Agrícola e da Zootecnia.

O simulador deve representar a instalação de equinos como um sistema físico-operacional em que clima externo, envoltória, ventilação, animais, cama, água, equipamentos e manejo interagem no tempo. O objetivo não é apenas “mostrar o estábulo”, mas permitir estudar, prever e otimizar conforto térmico, qualidade do ar, umidade, renovação de ar, carga térmica, consumo de energia e respostas de controle.

## Caso de uso prioritário
Use esta extensão quando o projeto envolver:
- Baias, cocheiras, galpões, piquetes cobertos, áreas de trato, selaria, corredor de manejo, enfermaria, sala de ração, depósito de feno, bebedouros e áreas de banho.
- Simulação de ambiência de equinos com ventilação natural, ventilação mecânica ou sistemas híbridos.
- Controle de temperatura, umidade, velocidade do ar, gases, poeira, radiação e carga térmica interna.
- Modelagem por volume de controle para analisar entradas, saídas, geração e acúmulo de energia e massa.
- Automação de cortinas, exaustores, ventiladores, nebulização, iluminação, sombreamento, alarmes e rotinas operacionais.
- Comparação entre cenários construtivos, operacionais e climáticos.

## Reenquadramento do problema
Para este domínio, a instalação deve ser tratada como um conjunto de volumes de controle acoplados.

Exemplos de volumes de controle:
- A baia individual.
- O corredor central.
- O galpão completo.
- A zona ocupada pelo animal.
- A zona superior próxima à cobertura.
- O reservatório/linha de água.
- O depósito de feno.
- O ambiente externo de referência.

Cada volume de controle pode trocar calor, vapor, massa de ar, poeira e gases com volumes vizinhos e com o exterior. Isso é fundamental para que o agente não construa apenas uma visualização bonita, mas um simulador tecnicamente coerente.

## Novo princípio orientador
Ao trabalhar com instalações de equinos, o agente deve assumir que o problema principal é o acoplamento entre:
- Animal.
- Edificação.
- Clima.
- Manejo.
- Automação.
- Energia.
- Qualidade do ar.
- Água e umidade.

A arquitetura deve ser capaz de responder perguntas como:
- Como a temperatura interna reage à radiação solar na cobertura ao longo do dia?
- Em que condição a ventilação natural deixa de ser suficiente?
- Qual o efeito de abrir cortinas laterais em diferentes velocidades de vento?
- Como a cama úmida altera a umidade relativa, a emissão de vapor e a qualidade ambiental?
- Qual arranjo reduz estresse térmico sem aumentar demais o consumo elétrico?
- Como comparar projetos de cobertura, pé-direito, lanternim e orientação da instalação?

## Novos módulos de domínio

### Instalação de equinos
Adicionar um módulo específico de infraestrutura zootécnica para equinos.

Representar:
- Tipologia da instalação.
- Número de animais por setor.
- Dimensões de baias e corredores.
- Pé-direito.
- Inclinação e material da cobertura.
- Orientação solar da edificação.
- Aberturas laterais e superiores.
- Tipo de piso.
- Tipo e espessura de cama.
- Áreas de alimentação, descanso e circulação.
- Fontes internas de umidade e calor.
- Equipamentos de ventilação e automação.

A instalação deve possuir parâmetros geométricos, térmicos, operacionais e sanitários.

### Módulo animal-equino
Criar um módulo específico para equinos, porque bovinos, aves e suínos possuem respostas ambientais e padrões de ocupação muito diferentes.

Estado mínimo por animal ou por grupo homogêneo:
- Categoria animal, por exemplo potro, égua, garanhão, atleta, manutenção.
- Massa corporal.
- Área ocupada e padrão de permanência.
- Nível de atividade.
- Produção metabólica de calor.
- Produção de vapor/umidade.
- Sensibilidade térmica.
- Consumo de água.
- Horário de alimentação, exercício e recolhimento.
- Estado de estresse ou conforto.

Abstrações úteis:
- Modelo por animal para baias individuais.
- Modelo por grupo para piquetes cobertos ou áreas coletivas.
- Perfis diários de atividade que mudem a geração metabólica.

### Ambiência e qualidade do ar
Criar um módulo dedicado à ambiência interna.

Variáveis candidatas:
- Temperatura do ar.
- Umidade relativa.
- Umidade absoluta ou razão de umidade.
- Velocidade do ar.
- Temperatura radiante média ou uma aproximação operacional.
- Temperatura de superfície de cobertura, paredes e piso.
- Concentração de gases, como amônia e dióxido de carbono, quando o escopo justificar.
- Poeira ou material particulado em nível simplificado.
- Taxa de renovação de ar.
- Índice de conforto térmico definido pelo projeto.

Trate qualidade do ar como sistema dinâmico, não como valor estático de painel.

### Automação predial rural
Adicionar um módulo de controle e automação.

Atores de controle:
- Ventiladores.
- Exaustores.
- Cortinas laterais.
- Lanternins com abertura variável.
- Nebulização ou resfriamento evaporativo, se fizer sentido para o cenário.
- Aspersão localizada.
- Iluminação.
- Alarmes.
- Rotinas por horário.

Estratégias de controle:
- Controle por limiar.
- Controle por histerese.
- Controle por agenda horária.
- Controle baseado em variáveis compostas.
- Controle supervisionado por cenários.
- Controle otimizado por custo de energia versus conforto.

## Volume de controle e balanços
Esta skill passa a exigir que o agente saiba estruturar o simulador por balanços físicos simplificados ou intermediários.

### Balanço de energia
Para cada volume de controle, o modelo deve considerar a lógica:
- Entrada de energia.
- Saída de energia.
- Geração interna.
- Acúmulo.

Possíveis termos energéticos:
- Ganho por radiação solar incidente em cobertura e fechamentos.
- Trocas por condução através da envoltória.
- Trocas por convecção com o ar externo e interno.
- Trocas associadas à ventilação e infiltração.
- Calor metabólico dos equinos.
- Calor sensível e latente associado a água, cama e processos evaporativos.
- Efeito de equipamentos, motores, iluminação ou aquecimento, se houver.
- Armazenamento térmico em materiais da construção.

O agente não precisa começar com um modelo CFD completo. Ele deve começar com modelo de parâmetros concentrados, multicompartment ou multizona, e só depois aumentar a complexidade.

### Balanço de massa
Para o ar e a umidade, considerar:
- Vazão de entrada e saída de ar.
- Infiltração.
- Geração de vapor pelos animais.
- Evaporação de piso, cama, água e lavagem.
- Remoção por ventilação.
- Acúmulo no volume interno.

Quando houver gases ou poeira:
- Taxa de emissão.
- Mistura entre zonas.
- Remoção por ventilação.
- Deposição ou decaimento simplificado.

### Estrutura de modelagem recomendada
Adotar uma escada de fidelidade:
1. Modelo 0D por instalação inteira.
2. Modelo multizona, por exemplo baia + corredor + zona superior + exterior.
3. Modelo por rede de volumes de controle acoplados.
4. Integração futura com CFD externo ou campos pré-computados, se necessário.

Para a maioria dos simuladores didáticos e de automação, um modelo multizona já entrega excelente custo-benefício.

## Variáveis e parâmetros obrigatórios
Ao responder sobre esse domínio, o agente deve tentar explicitar pelo menos estes grupos de variáveis.

### Geometria e construção
- Comprimento, largura e altura.
- Área de cobertura.
- Inclinação do telhado.
- Orientação cardeal.
- Área de aberturas.
- Relação abertura/volume.
- Volume interno total.
- Materiais e propriedades térmicas simplificadas.
- Presença de forro, isolante, lanternim, beiral e sombreamento externo.

### Ambiente externo
- Temperatura do ar externo.
- Umidade relativa externa.
- Velocidade e direção do vento.
- Radiação solar global ou uma aproximação de carga solar.
- Nebulosidade simplificada, se usada.
- Precipitação quando afetar operação ou umidade.
- Série temporal diária/sazonal.

### Animal e manejo
- Número de equinos.
- Massa média.
- Regime de ocupação.
- Atividade física ao longo do dia.
- Horário de alimentação.
- Horário de limpeza/lavagem.
- Frequência de troca de cama.
- Consumo de água.
- Permanência em baia versus área externa.

### Operação e automação
- Setpoints.
- Bandas de histerese.
- Prioridade entre conforto, energia e sanidade.
- Regras de acionamento por zona.
- Sensores disponíveis e falhas possíveis.
- Horários de bloqueio operacional.

## Sensores e telemetria
Para tornar o simulador útil em automação, incluir uma camada explícita de sensoriamento.

Sensores possíveis:
- Temperatura do ar por zona.
- Umidade relativa por zona.
- Temperatura de superfície de cobertura.
- Velocidade do ar ou estado lógico de ventilação.
- Presença/ocupação animal.
- Consumo elétrico dos atuadores.
- Abertura de cortinas.
- Vazão de ventiladores ou estado ligado/desligado.
- Nível de água.
- Estado de cama seca/úmida em índice simplificado.

Boas práticas:
- Diferenciar valor real do sistema e valor medido com ruído.
- Simular atraso de leitura e falhas intermitentes quando o objetivo for automação robusta.
- Permitir gravação de séries temporais para análise comparativa.

## Atuadores
Representar atuadores com dinâmica e restrições.

Cada atuador deve ter:
- Estado.
- Capacidade.
- Tempo de resposta.
- Consumo de energia.
- Faixa de operação.
- Lógica de comando.
- Falhas possíveis.

Exemplos:
- Cortina abre de 0% a 100% com velocidade finita.
- Ventilador tem vazão nominal, curva simplificada e consumo elétrico.
- Nebulização aumenta umidade e reduz temperatura em certas condições, mas pode piorar o ambiente se usada fora do regime adequado.

## Modos de simulação recomendados
O agente deve oferecer modos de uso distintos.

### Modo projeto
Serve para comparar tipologias construtivas.
- Orientação da instalação.
- Tipos de cobertura.
- Pé-direito.
- Lanternim.
- Tamanho de aberturas.
- Sombreamento.
- Layout das baias.

### Modo operação
Serve para testar regras de automação e manejo diário.
- Abrir/fechar cortinas.
- Ligar/desligar ventiladores.
- Simular limpeza, banho, trato e recolhimento.
- Testar agenda operacional por hora.

### Modo pesquisa
Serve para rodar cenários e exportar resultados.
- Séries meteorológicas.
- Diferentes lotações.
- Materiais de cobertura.
- Estratégias de controle.
- Sensibilidade paramétrica.
- Comparação de conforto versus energia.

### Modo didático
Serve para ensino.
- Mostrar fluxos de energia animados.
- Mostrar setas de massa de ar.
- Exibir volume de controle destacado.
- Congelar o tempo e explicar cada termo do balanço.
- Alternar entre vista imersiva e vista analítica.

## Estratégia de renderização em Three.js para este caso
A renderização deve ser subordinada à física do ambiente.

### Instalação como objeto analítico
A instalação 3D não deve ser apenas decorativa. Cada elemento construtivo precisa estar ligado a propriedades físicas e operacionais.

Elementos recomendados:
- Cobertura segmentada por água/fachada.
- Paredes e meia-paredes.
- Aberturas e cortinas móveis.
- Lanternim.
- Baias individuais.
- Corredores.
- Área de armazenamento de feno e ração.
- Pontos de água.
- Camas/piso por setor.

### Camadas visuais analíticas
Adicionar visualizações específicas:
- Mapa de temperatura por zona.
- Setas de fluxo de ar entre volumes de controle.
- Gradiente de umidade.
- Estado dos atuadores.
- Mapa de superfícies quentes/frias.
- Destaque da radiação incidente por horário.
- Rastro temporal de conforto dos animais.

### Representação dos equinos
Os cavalos podem ser renderizados em níveis diferentes:
- Silhueta simplificada para simulações de lote.
- Modelo low-poly animado para inspeção visual.
- Estado térmico representado por halo, cor ou indicadores discretos.

A resposta do animal ao ambiente deve aparecer visualmente, mas a malha 3D nunca deve carregar a física principal.

### Overlays científicos
O projeto deve oferecer pelo menos três visões:
- Vista realista/imersiva.
- Vista analítica térmica.
- Vista de automação e sensoriamento.

Na vista analítica, priorizar legibilidade sobre realismo.

## Interação e UX especializada
Para esse domínio, o agente deve sugerir controles específicos.

Ferramentas importantes:
- Selecionar um volume de controle.
- Inspecionar balanço de energia do volume atual.
- Traçar gráfico temporal de temperatura, umidade e carga térmica.
- Alterar cobertura, abertura e orientação.
- Inserir ou remover animais.
- Programar regras de automação.
- Comparar dois cenários lado a lado.
- Rodar um dia típico de verão/inverno.
- Acelerar o tempo e congelar eventos críticos.

Painéis úteis:
- Resumo climático externo.
- Estado de cada zona interna.
- Consumo energético dos atuadores.
- Índice de conforto por animal ou grupo.
- Alertas sanitários/ambientais.
- Histórico de acionamentos.

## Índices e métricas
A skill original fala em conforto e observabilidade, mas aqui é preciso explicitar as métricas do domínio.

Sugestões de métricas:
- Temperatura média e máxima por zona.
- Umidade relativa média e picos.
- Horas fora da faixa de conforto.
- Taxa de renovação de ar estimada.
- Carga térmica por componente.
- Consumo acumulado de energia dos atuadores.
- Eficiência da estratégia de controle.
- Índice simplificado de risco por calor.
- Índice de cama úmida.
- Tempo de resposta do sistema a eventos externos.

As métricas devem ser comparáveis entre cenários.

## Estratégia de modelagem computacional
Para este problema, recomendar uma arquitetura específica de simulação.

### Núcleo físico
Criar um núcleo responsável por:
- Balanço térmico por zonas.
- Balanço de umidade.
- Troca entre volumes.
- Ganhos solares simplificados.
- Efeitos dos atuadores.
- Geração animal e operacional.

### Núcleo zootécnico-operacional
Criar um núcleo responsável por:
- Presença e rotina dos equinos.
- Manejo diário.
- Ocupação por setor.
- Fontes de umidade operacional.
- Regras de bem-estar e alerta.

### Núcleo de automação
Criar um núcleo responsável por:
- Sensoriamento virtual.
- Controle.
- Supervisão.
- Histórico de comandos.
- Modos manual, automático e assistido.

### Núcleo visual
Criar um núcleo responsável por:
- Geometria da instalação.
- Materiais vinculados a propriedades.
- Overlays científicos.
- Animadores de fluxo e estado.
- HUD e gráficos.

## Estrutura de pastas especializada
Quando a solicitação envolver instalações de equinos com ambiência e automação, preferir uma estrutura como:

```text
src/
  core/
    app.ts
    clock.ts
    config.ts
    units.ts
    event-bus.ts
  domain/
    equine/
      horse-profile.ts
      occupancy.ts
      metabolism.ts
      welfare.ts
    facility/
      barn-layout.ts
      envelope.ts
      openings.ts
      bedding.ts
      water-system.ts
    climate/
      weather.ts
      solar.ts
      psychrometrics.ts
  sim/
    state/
      world-state.ts
      facility-state.ts
      zone-state.ts
    systems/
      energy-balance-system.ts
      moisture-balance-system.ts
      airflow-network-system.ts
      animal-heat-system.ts
      automation-system.ts
      sensor-system.ts
      scenario-system.ts
    control/
      controllers/
      rules/
      schedules/
    scenarios/
  render/
    facility/
    horses/
    overlays/
      heatmap/
      airflow/
      sensors/
      control-volume/
    ui/
      dashboards/
      inspectors/
      charts/
  data/
    presets/
      equine/
      materials/
      climates/
      controllers/
    telemetry/
    saves/
```

## Vertical slices recomendados para este objetivo
Como o seu objetivo é bem específico, a skill deve recomendar uma progressão mais alinhada ao caso de equinos.

### Slice 1
Geometria da instalação + clima externo simplificado + uma zona térmica interna + um grupo de cavalos + gráfico temporal.

### Slice 2
Adicionar múltiplas zonas, cortinas laterais, ventiladores, sensores e regras de automação simples.

### Slice 3
Adicionar umidade, cama, lavagem, fonte de vapor, armazenamento térmico da cobertura e comparação entre cenários.

### Slice 4
Adicionar análise por volume de controle com sobreposição visual dos fluxos de energia e massa.

### Slice 5
Adicionar otimização ou apoio à decisão, por exemplo comparar conforto animal versus energia consumida.

## Perguntas que o agente deve fazer antes de propor solução
Ao detectar esse domínio, o agente deve perguntar:
- A instalação é aberta, semiaberta ou fechada?
- O foco é didático, pesquisa, projeto, operação ou automação real?
- O modelo será por baias, por galpão, por zona ou por animal?
- Quais variáveis ambientais são prioritárias?
- Haverá apenas ventilação natural ou também ventiladores/exaustores?
- O objetivo é conforto térmico, qualidade do ar, consumo energético, ou todos?
- Deseja modelo simplificado, intermediário ou preparado para calibração futura?
- Quer comparar alternativas construtivas?
- Haverá integração com dados reais de sensores no futuro?

## Anti-padrões adicionais
Evitar especialmente:
- Modelar conforto animal apenas com cor bonita ou efeito visual sem variáveis físicas.
- Misturar temperatura externa com temperatura interna sem volume de controle explícito.
- Tratar ventilação como efeito gráfico sem impacto em balanço de energia e massa.
- Ignorar o papel da umidade da cama e da operação de limpeza.
- Construir um estábulo detalhado em 3D sem sensores, métricas e cenários comparáveis.
- Acoplar diretamente lógica de controle aos componentes visuais.
- Usar apenas um valor médio para toda a instalação quando o problema exige zonas.

## Expansões futuras
Depois da base, esta skill pode evoluir para:
- Calibração com dados reais de sensores IoT.
- Simulação multiobjetivo conforto x energia x custo.
- Acoplamento com previsão do tempo.
- Acoplamento com geração solar e gestão energética da fazenda.
- CFD simplificado por campos pré-calculados.
- Modelagem acústica e iluminação natural/artificial.
- Módulo sanitário com poeira, gases e higiene.
- Gêmeo digital operacional para instalação real.

## Regra final desta extensão
Quando o projeto for uma instalação de equinos com automação de ambiência, o agente deve tratar o Three.js como a interface espacial de um simulador termo-higrométrico e operacional por volumes de controle, e não apenas como motor de maquete 3D.