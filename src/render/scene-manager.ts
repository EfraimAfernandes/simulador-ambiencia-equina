import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  
  private container: HTMLElement;
  private sunRaysGroup: THREE.Group;
  
  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container com ID '${containerId}' não encontrado.`);
    }
    this.container = container;
    
    // 1. Criação da Cena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc); // Sky-300 (Azul alegre inicial)
    this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.012);
    
    // 2. Criação da Câmera
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(16, 12, 20);
    
    // 3. Inicialização do Renderizador
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);
    
    // 4. Controles Orbitais
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1; // Evita ir abaixo do chão
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;
    this.controls.target.set(0, 2, 0);
    
    // 5. Iluminação
    // Luz Ambiente
    this.ambientLight = new THREE.AmbientLight(0xbae6fd, 0.4); // Azul celeste suave e mais claro
    this.scene.add(this.ambientLight);
    
    // Luz Direcional (Sol)
    this.sunLight = new THREE.DirectionalLight(0xfef08a, 1.2); // Amarelo sol quente
    this.sunLight.position.set(20, 25, 15);
    this.sunLight.castShadow = true;
    
    // Configurações de Sombra da Luz do Sol
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 70;
    const shadowSize = 25;
    this.sunLight.shadow.camera.left = -shadowSize;
    this.sunLight.shadow.camera.right = shadowSize;
    this.sunLight.shadow.camera.top = shadowSize;
    this.sunLight.shadow.camera.bottom = -shadowSize;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    
    // Adicionar Grid no Chão discreto para referência espacial
    const gridHelper = new THREE.GridHelper(60, 60, 0x16a34a, 0x86efac);
    gridHelper.position.y = -0.005;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.15;
    this.scene.add(gridHelper);
    
    // Adicionar plano de solo infinito para sombras (Grama Verde Viva e Alegre)
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80, // Green-400 (Vibrante e alegre)
      roughness: 0.9,
      metalness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    // Grupo de raios solares volumétricos
    this.sunRaysGroup = new THREE.Group();
    this.scene.add(this.sunRaysGroup);
    this.buildSunRays();
    
    // Monitor de redimensionamento
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  /**
   * Constrói os raios solares volumétricos (God Rays)
   */
  private buildSunRays(): void {
    const numRays = 8;
    const rayMaterial = new THREE.MeshBasicMaterial({
      color: 0xfffbeb, // Amarelo palha claro quente
      transparent: true,
      opacity: 0.0, // Controlado reativamente pelo sol
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    for (let i = 0; i < numRays; i++) {
      // Cones alongados: topo fino, base larga para efeito crepuscular flare
      const rayGeo = new THREE.CylinderGeometry(0.05, 1.2 + Math.random() * 0.8, 50, 8, 1, true);
      const ray = new THREE.Mesh(rayGeo, rayMaterial.clone());
      
      // Espalhar ao redor do estábulo
      const offsetX = (Math.random() - 0.5) * 24;
      const offsetZ = (Math.random() - 0.5) * 16;
      
      ray.userData = {
        offsetX,
        offsetZ,
        speed: 0.05 + Math.random() * 0.1
      };
      
      this.sunRaysGroup.add(ray);
    }
  }
  
  /**
   * Adapta a câmera e o renderizador ao tamanho do contêiner
   */
  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }
  
  /**
   * Atualiza a cor e intensidade da iluminação baseada na radiação solar simulada
   */
  public updateSun(radiation: number): void {
    // Escala de radiação de 0 a 1000 W/m²
    const intensity = THREE.MathUtils.lerp(0.1, 1.6, radiation / 1000);
    this.sunLight.intensity = intensity;
    
    const color = new THREE.Color();
    let skyColor: THREE.Color;
    let ambientHex: number;
    let ambientIntensity: number;
    
    if (radiation < 100) {
      // Noite / Crepúsculo escuro
      color.setHSL(0.05, 0.8, 0.4);
      skyColor = new THREE.Color(0x0f172a); // Slate-900 escuro
      ambientHex = 0x1e1b4b; // Azul escuro da noite
      ambientIntensity = 0.2;
    } else if (radiation < 500) {
      // Entardecer / Amanhecer vívido (Dourado/Laranja alegre)
      color.setHSL(0.08, 0.95, 0.65);
      skyColor = new THREE.Color(0xfdba74); // Orange-300
      ambientHex = 0xffedd5; // Laranja suave aconchegante
      ambientIntensity = 0.5;
    } else {
      // Dia claro e radiante (Azul celeste)
      color.setHSL(0.16, 0.9, 0.9);
      skyColor = new THREE.Color(0x7dd3fc); // Sky-300
      ambientHex = 0xe0f2fe; // Azul celeste muito claro
      ambientIntensity = 0.7;
    }
    
    this.sunLight.color.copy(color);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.012);
    
    this.ambientLight.color.setHex(ambientHex);
    this.ambientLight.intensity = ambientIntensity;
    
    // Atualizar posição do Sol para simular movimento solar
    const angle = THREE.MathUtils.lerp(Math.PI * 0.9, Math.PI * 0.3, radiation / 1000);
    this.sunLight.position.x = 25 * Math.cos(angle);
    this.sunLight.position.y = 25 * Math.sin(angle);
    
    // ─── Atualizar Raios de Sol Volumétricos ─────────────────────
    const dir = this.sunLight.position.clone().normalize();
    const targetDir = dir.clone().negate();
    const alignVector = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(alignVector, targetDir);
    
    // Opacidade alvo com base na radiação (zero à noite, brilha no sol forte)
    const maxRayOpacity = 0.15;
    const targetOpacity = radiation < 150 ? 0.0 : THREE.MathUtils.lerp(0.0, maxRayOpacity, (radiation - 150) / 850);
    
    this.sunRaysGroup.children.forEach(ray => {
      const mesh = ray as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = targetOpacity;
      
      // Rotaciona o cilindro para alinhar com os raios solares
      mesh.quaternion.copy(quaternion);
      
      // Deriva de oscilação lenta dos raios no plano do chão
      const offset = mesh.userData;
      const time = performance.now() * 0.001;
      const currentX = offset.offsetX + Math.sin(time * offset.speed) * 2.0;
      const currentZ = offset.offsetZ + Math.cos(time * offset.speed) * 2.0;
      
      // Posiciona o cilindro para que ele termine exatamente no chão
      mesh.position.set(currentX, 0, currentZ);
      mesh.position.addScaledVector(targetDir, -25); // Desloca para cima ao longo do vetor do sol
    });
  }
  
  /**
   * Renderiza um frame
   */
  public render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

