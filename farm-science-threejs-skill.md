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
