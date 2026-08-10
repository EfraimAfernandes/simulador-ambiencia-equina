Three.js: Skill para Web-Interativa (Alta Performance)
1. Filosofia da Web-Interativa 3D
Uma experiência web-interativa de sucesso não é apenas "bonita" — ela responde ao usuário de forma orgânica, instantânea e satisfatória. No estilo Messenger (Abeto), a interação deve parecer brincadeira: objetos pulam, mudam de cor, o planeta treme levemente, e cada ação gera uma reação cartunesca.

Pilares desta Skill:

Input Agnóstico (Mouse + Touch + Teclado)

Raycaster Inteligente (Picking com prioridade)

Feedback Imediato (Escala, Cor, Partículas, Áudio)

Animações Fluidas (Lerp, Spring, GSAP)

Gerenciamento de Estado (UI reativa ao 3D)

Otimização para Múltiplos Toques (Mobile-first)

2. Configuração Base com Foco em Interação
Diferente de uma cena estática, precisamos de um sistema de eventos global e um Raycaster preparado.

javascript
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// --- Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 4, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Controles customizados (desative o OrbitControls se for um jogo, mas mantenha para debug)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.2;
controls.target.set(0, 0.5, 0);

// --- SISTEMA DE INTERAÇÃO (Heart of the Skill) ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectedObject = null;
let hoveredObject = null;

// Lista de objetos interativos
const interactables = [];

// Função para registrar objetos interativos
function registerInteractive(mesh, data = {}) {
  mesh.userData = { ...mesh.userData, ...data, isInteractive: true };
  interactables.push(mesh);
  return mesh;
}
3. Gerenciamento de Eventos (Mouse + Touch unificados)
Usamos PointerEvents para unificar mouse e toque, garantindo que funcione perfeitamente em iPads e celulares.

javascript
// 1. Movimento do Pointer (Hover)
renderer.domElement.addEventListener('pointermove', (event) => {
  // Normalizar coordenadas
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(interactables, false); // false = não recursivo

  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (hoveredObject !== obj) {
      // Saída do hover anterior
      if (hoveredObject) onPointerOut(hoveredObject);
      // Entrada no novo hover
      hoveredObject = obj;
      onPointerOver(obj, intersects[0]);
    }
  } else {
    if (hoveredObject) {
      onPointerOut(hoveredObject);
      hoveredObject = null;
    }
  }
});

// 2. Clique / Toque (Pointer Down + Up para evitar drag acidental)
let pointerDownTime = 0;
let pointerDownPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDownTime = performance.now();
  pointerDownPos.x = event.clientX;
  pointerDownPos.y = event.clientY;
});

renderer.domElement.addEventListener('pointerup', (event) => {
  const dt = performance.now() - pointerDownTime;
  const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
  
  // Considera "clique" apenas se for rápido (< 300ms) e com pouco movimento (< 10px)
  if (dt < 300 && dist < 10) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(interactables, false);
    if (intersects.length > 0) {
      onClick(intersects[0].object, intersects[0]);
    }
  }
});

// Prevenir comportamento padrão de toque (scroll, zoom)
renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.target === renderer.domElement) e.preventDefault();
}, { passive: false });
4. Feedback Visual e Cartunesco (O "Sabor" Messenger)
A interação no Messenger nunca é seca. Sempre há um squash-and-stretch, mudança de cor ou emissão de partículas.

4.1 Funções de Callback
javascript
// Efeito de Hover (flutuar e brilhar)
function onPointerOver(obj, intersect) {
  // Guarda estado original
  if (!obj.userData._origScale) {
    obj.userData._origScale = obj.scale.clone();
    obj.userData._origColor = obj.material.color.clone();
  }
  
  // Animação de "levitar" (escala e posição)
  gsap.to(obj.scale, { 
    x: obj.userData._origScale.x * 1.15, 
    y: obj.userData._origScale.y * 1.15, 
    z: obj.userData._origScale.z * 1.15,
    duration: 0.3, 
    ease: "backOut(1.7)" 
  });
  
  // Brilho (emissive) - se material tiver
  if (obj.material.emissive) {
    gsap.to(obj.material, { 
      emissiveIntensity: 0.4, 
      duration: 0.2 
    });
  }
  
  // Mudança de cursor
  renderer.domElement.style.cursor = 'pointer';
}

function onPointerOut(obj) {
  // Volta ao normal
  gsap.to(obj.scale, { 
    x: obj.userData._origScale.x, 
    y: obj.userData._origScale.y, 
    z: obj.userData._origScale.z,
    duration: 0.5, 
    ease: "elasticOut(1, 0.3)" 
  });
  
  if (obj.material.emissive) {
    gsap.to(obj.material, { emissiveIntensity: 0, duration: 0.5 });
  }
  
  renderer.domElement.style.cursor = 'default';
}

// Efeito de Clique (explosão de partículas + pulo)
function onClick(obj, intersect) {
  // 1. Pulso (Squash)
  gsap.timeline()
    .to(obj.scale, { 
      x: obj.userData._origScale.x * 0.7, 
      y: obj.userData._origScale.y * 1.4, 
      z: obj.userData._origScale.z * 0.7,
      duration: 0.15,
      ease: "power2.out"
    })
    .to(obj.scale, { 
      x: obj.userData._origScale.x, 
      y: obj.userData._origScale.y, 
      z: obj.userData._origScale.z,
      duration: 0.4,
      ease: "elasticOut(1, 0.4)"
    });

  // 2. Emitir Partículas (estilo confete)
  createBurstParticles(intersect.point, obj.material.color);
  
  // 3. Atualizar UI (exemplo: contador de cliques)
  updateUI(obj);
  
  // 4. Emitir evento personalizado para outros sistemas
  window.dispatchEvent(new CustomEvent('objectClicked', { detail: { object: obj } }));
}
4.2 Sistema de Partículas para Feedback (Burst)
javascript
function createBurstParticles(position, color) {
  const count = 30;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = [];

  const baseColor = new THREE.Color(color);

  for (let i = 0; i < count; i++) {
    positions[i*3] = position.x;
    positions[i*3+1] = position.y;
    positions[i*3+2] = position.z;
    
    colors[i*3] = baseColor.r * (0.5 + Math.random() * 0.5);
    colors[i*3+1] = baseColor.g * (0.5 + Math.random() * 0.5);
    colors[i*3+2] = baseColor.b * (0.5 + Math.random() * 0.5);
    
    velocities.push({
      x: (Math.random() - 0.5) * 0.15,
      y: Math.random() * 0.2 + 0.05,
      z: (Math.random() - 0.5) * 0.15
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Animação das partículas (física simples)
  let life = 1.0;
  const speed = 0.016;
  const animateParticles = () => {
    life -= speed * 1.5;
    if (life <= 0) {
      scene.remove(particles);
      geometry.dispose();
      material.dispose();
      return;
    }

    const pos = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i*3] += velocities[i].x;
      pos[i*3+1] += velocities[i].y;
      pos[i*3+2] += velocities[i].z;
      velocities[i].y -= 0.005; // gravidade
    }
    geometry.attributes.position.needsUpdate = true;
    material.opacity = life;
    requestAnimationFrame(animateParticles);
  };
  animateParticles();
}
5. Interação com Câmera (LookAt e Movimento)
No Messenger, a câmera frequentemente reage ao jogador. Vamos criar um sistema de foco suave.

javascript
let cameraTarget = new THREE.Vector3(0, 0.5, 0);
let isCameraAnimating = false;

function focusOnObject(obj, instant = false) {
  const worldPos = new THREE.Vector3();
  obj.getWorldPosition(worldPos);
  
  // Posiciona a câmera em frente ao objeto
  const offset = new THREE.Vector3(2, 1.5, 3);
  const targetPos = worldPos.clone().add(offset);
  
  if (instant) {
    camera.position.copy(targetPos);
    controls.target.copy(worldPos);
    controls.update();
  } else {
    isCameraAnimating = true;
    gsap.to(camera.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 0.8,
      ease: "power2.inOut",
      onUpdate: () => {
        controls.target.lerp(worldPos, 0.05);
        controls.update();
      },
      onComplete: () => { isCameraAnimating = false; }
    });
  }
}

// Exemplo: clique duplo foca no objeto
renderer.domElement.addEventListener('dblclick', (event) => {
  // ... raycast ...
  if (intersects.length > 0) {
    focusOnObject(intersects[0].object);
  }
});
6. Integração com UI/HTML (Overlays Reativos)
Uma web-interativa usa HTML/CSS para informações contextuais que flutuam sobre o 3D.

javascript
// Criar Tooltip 3D -> 2D projection
const tooltip = document.createElement('div');
tooltip.style.cssText = `
  position: absolute; pointer-events: none; 
  background: rgba(255, 245, 235, 0.95); 
  backdrop-filter: blur(4px);
  padding: 8px 16px; border-radius: 20px;
  font-family: 'Segoe UI', sans-serif; font-size: 14px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  color: #4a3a2a; border: 1px solid rgba(255,255,255,0.5);
  transition: opacity 0.2s; opacity: 0;
`;
document.body.appendChild(tooltip);

function updateTooltip(object3D, text) {
  if (!object3D) {
    tooltip.style.opacity = 0;
    return;
  }
  const pos = new THREE.Vector3();
  object3D.getWorldPosition(pos);
  pos.y += 0.8; // altura do tooltip
  
  pos.project(camera);
  const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
  
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  tooltip.style.opacity = 1;
  tooltip.textContent = text;
}

// No hover:
function onPointerOver(obj, intersect) {
  // ... existing code ...
  const label = obj.userData.label || 'Interagir';
  updateTooltip(obj, label);
}

function onPointerOut(obj) {
  // ... existing code ...
  updateTooltip(null);
}
7. Arrastar e Soltar (Drag & Drop) com Física Suave
Para objetos arrastáveis (como no Messenger ao mover o personagem ou itens):

javascript
let dragObject = null;
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();
let dragIntersect = new THREE.Vector3();

renderer.domElement.addEventListener('pointerdown', (e) => {
  // ... raycast ...
  if (intersects.length > 0 && intersects[0].object.userData.draggable) {
    dragObject = intersects[0].object;
    // Plano de arraste paralelo à câmera
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    dragPlane.setFromNormalAndCoplanarPoint(camDir, dragObject.position);
    
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, pt);
    if (pt) {
      dragOffset.copy(pt).sub(dragObject.position);
    }
    controls.enabled = false; // desativa orbit ao arrastar
    renderer.domElement.style.cursor = 'grabbing';
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (dragObject) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, pt);
    if (pt) {
      dragObject.position.copy(pt.sub(dragOffset));
      // Se estiver em um planeta, alinha à superfície (opcional)
    }
  }
});

window.addEventListener('pointerup', () => {
  if (dragObject) {
    // Solta com animação (spring)
    gsap.to(dragObject.position, {
      x: Math.round(dragObject.position.x * 10) / 10, // snap para grid
      y: Math.round(dragObject.position.y * 10) / 10,
      z: Math.round(dragObject.position.z * 10) / 10,
      duration: 0.5,
      ease: "elasticOut(1, 0.3)"
    });
    dragObject = null;
    controls.enabled = true;
    renderer.domElement.style.cursor = 'default';
  }
});
8. Gerenciamento de Estado e Reactividade
Para uma web-interativa robusta, precisamos de um Store simples.

javascript
// Estado global
const state = {
  score: 0,
  collectedItems: [],
  currentView: 'overview',
  isMuted: false
};

// Função para atualizar UI quando o estado muda
function updateUI(obj) {
  state.score++;
  document.getElementById('score-display').textContent = `✨ ${state.score}`;
  
  // Exemplo: mudar cor de fundo baseado no score
  const hue = 30 + (state.score * 3) % 30;
  scene.background.setHSL(hue / 360, 0.2, 0.92);
}

// Escutar eventos do jogo
window.addEventListener('objectClicked', (e) => {
  const obj = e.detail.object;
  if (obj.userData.type === 'collectible') {
    state.collectedItems.push(obj.id);
    // Remover da cena com animação
    gsap.to(obj.scale, { x: 0, y: 0, z: 0, duration: 0.3, onComplete: () => {
      scene.remove(obj);
    }});
  }
});
9. Efeitos Avançados de Interação (Sacudir, Tilt)
Para dar aquele "feeling" cartunesco:

javascript
// Sacudir objeto (shake)
function shakeObject(obj, intensity = 0.05, duration = 0.5) {
  const origPos = obj.position.clone();
  gsap.to(obj.position, {
    x: origPos.x + (Math.random() - 0.5) * intensity,
    y: origPos.y + (Math.random() - 0.5) * intensity,
    z: origPos.z + (Math.random() - 0.5) * intensity,
    duration: 0.05,
    repeat: duration / 0.05,
    yoyo: true,
    onComplete: () => obj.position.copy(origPos)
  });
}

// Tilt (inclinar) baseado no movimento do mouse
let mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  
  // Aplicar tilt suave em objetos com a classe .tilt
  interactables.forEach(obj => {
    if (obj.userData.tiltable) {
      gsap.to(obj.rotation, {
        x: mouseY * 0.1,
        z: -mouseX * 0.1,
        duration: 0.5,
        ease: "power2.out"
      });
    }
  });
});
10. Performance em Interações Múltiplas (Mobile)
Throttle eventos de pointermove para 60fps (use requestAnimationFrame para ler o último evento).

Instancing para objetos repetidos (como grama/pedras) que precisam ser clicáveis? Use InstancedMesh com Raycaster suportado nativamente via instanceId.

Desative sombras durante o arraste para ganhar FPS.

javascript
// Exemplo de throttling para pointermove
let moveEvent = null;
renderer.domElement.addEventListener('pointermove', (e) => { moveEvent = e; });

function animate() {
  requestAnimationFrame(animate);
  if (moveEvent) {
    // Processa apenas um evento por frame
    processPointerMove(moveEvent);
    moveEvent = null;
  }
  controls.update();
  renderer.render(scene, camera);
}
11. Exemplo Prático: Cena Interativa Completa
javascript
// Cria alguns objetos interativos
const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const mat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.3, emissive: 0xd4a373, emissiveIntensity: 0 });
const box = new THREE.Mesh(geo, mat);
box.position.set(1, 0.3, 0);
box.castShadow = true;
registerInteractive(box, { label: 'Caixa Mágica', type: 'collectible', tiltable: true, draggable: true });
scene.add(box);

const sphereMat = new THREE.MeshStandardMaterial({ color: 0x7a9bb5, roughness: 0.2 });
const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 24), sphereMat);
sphere.position.set(-1, 0.4, 0.5);
sphere.castShadow = true;
registerInteractive(sphere, { label: 'Planeta Água', type: 'info' });
scene.add(sphere);

// Adiciona o pós-processamento de grão e outline (conforme a skill anterior)
// ... (código de grain e outline aqui)

// Loop principal
function animate() {
  requestAnimationFrame(animate);
  
  // Rotação automática para dar vida
  if (!dragObject) {
    box.rotation.y += 0.005;
    sphere.rotation.x += 0.003;
  }
  
  controls.update();
  renderer.render(scene, camera);
}
animate();
12. Conclusão: O DNA da Web-Interativa
Característica	Implementação
Toque/Mouse	PointerEvents + Throttle
Picking	Raycaster com intersectObjects
Feedback	GSAP (Squash, Stretch, Elastic)
Partículas	Points com física simples
UI Reativa	Projeção 3D->2D + CSS Overlays
Estado	Objeto global state + Eventos Customizados
Performance	setPixelRatio(2), Instancing, Desativa sombras em drag
Com esta skill, você consegue construir desde pequenos jogos casuais até showrooms interativos de produtos, sempre com aquele toque artesanal e responsivo que lembra as criações da Abeto.