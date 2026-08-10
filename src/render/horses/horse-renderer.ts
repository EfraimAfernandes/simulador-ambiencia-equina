import * as THREE from 'three';
import { getEquineComfortIndex } from '../../domain/climate/psychrometrics.ts';

/**
 * Cria uma textura de ruído linear em tempo real para simular pelos da pelagem (Fur/Hair)
 */
function createFurBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error("Não foi possível inicializar contexto 2d no canvas de textura do pelo.");
  }
  
  // Base cinza médio para mapa de relevo (bump map)
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  
  // Desenhar micro estrias de pelo na diagonal
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const len = 4 + Math.random() * 6;
    const thickness = 0.5 + Math.random() * 1.0;
    
    // Leve variação do cinza médio simula ranhuras de pelos
    const val = 128 + (Math.random() - 0.5) * 60;
    ctx.strokeStyle = `rgb(${val}, ${val}, ${val})`;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + len * 0.15); // inclinação do pelo
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 8); // Repete para ficar fino no modelo
  return texture;
}

interface HorseCoat {
  bodyColor: number;
  maneColor: number;
  hoofColor: number;
  eyeColor: number;
  sheenColor: number;
  clearcoat: number;
  metalness: number;
  roughness: number;
  blackLegs: boolean; // Pernas escuras (característica de baio)
}

export class HorseRenderer {
  public group: THREE.Group;
  
  public horses: THREE.Group[] = [];
  private comfortHalos: THREE.Mesh[] = [];
  
  // Referências para animação individual de caudas e pescoços
  private tails: THREE.Mesh[] = [];
  private necks: THREE.Mesh[] = [];
  
  // Textura compartilhada de pelos
  private furBumpMap: THREE.CanvasTexture;
  
  // Paleta de Conforto
  private readonly colorComfort = new THREE.Color(0x22c55e); // Verde
  private readonly colorWarning = new THREE.Color(0xeab308); // Amarelo
  private readonly colorDanger = new THREE.Color(0xef4444);  // Vermelho
  
  // Definições de Raças/Pelagens de Cavalos
  private readonly coats: HorseCoat[] = [
    { // Cavalo 1: Alazão (Chestnut)
      bodyColor: 0x9a3412, // Vermelho acobreado
      maneColor: 0xc2410c,  // Crina avermelhada clara
      hoofColor: 0x334155,  // Casco ardósia
      eyeColor: 0x09090b,
      sheenColor: 0xf97316,
      clearcoat: 0.3,
      metalness: 0.1,
      roughness: 0.5,
      blackLegs: false
    },
    { // Cavalo 2: Zaino Escuro (Dark Bay/Black)
      bodyColor: 0x18181b, // Preto polido
      maneColor: 0x09090b,  // Crina preta pura
      hoofColor: 0x1e293b,
      eyeColor: 0x020617,
      sheenColor: 0x475569,
      clearcoat: 0.5, // Brilha muito (pelo sadio zaino)
      metalness: 0.2,
      roughness: 0.45,
      blackLegs: false
    },
    { // Cavalo 3: Tordilho (Grey/White)
      bodyColor: 0xe2e8f0, // Branco acinzentado
      maneColor: 0x94a3b8,  // Crina cinza
      hoofColor: 0x475569,
      eyeColor: 0x09090b,
      sheenColor: 0xffffff,
      clearcoat: 0.25,
      metalness: 0.1,
      roughness: 0.6,
      blackLegs: false
    },
    { // Cavalo 4: Baio Cabos Negros (Bay)
      bodyColor: 0xd97706, // Dourado
      maneColor: 0x09090b,  // Crina preta
      hoofColor: 0x1e293b,
      eyeColor: 0x09090b,
      sheenColor: 0xfbbf24,
      clearcoat: 0.35,
      metalness: 0.15,
      roughness: 0.48,
      blackLegs: true // Canelas pretas
    }
  ];
  
  constructor() {
    this.group = new THREE.Group();
    this.furBumpMap = createFurBumpTexture();
  }
  
  /**
   * Constrói e posiciona os cavalos nas cocheiras individuais
   */
  public setupHorses(numHorses: number, cvLength: number, cvWidth: number): void {
    // Limpar anteriores
    this.horses.forEach(h => this.group.remove(h));
    this.comfortHalos.forEach(h => this.group.remove(h));
    this.horses = [];
    this.comfortHalos = [];
    this.tails = [];
    this.necks = [];
    
    // Coordenadas das cocheiras (2 no lado esquerdo Z negativo, 2 no lado direito Z positivo)
    const positions = [
      new THREE.Vector3(-cvLength / 4, 0, -cvWidth / 3.2), // Cocheira 1
      new THREE.Vector3(cvLength / 4, 0, -cvWidth / 3.2),  // Cocheira 2
      new THREE.Vector3(-cvLength / 4, 0, cvWidth / 3.2),  // Cocheira 3
      new THREE.Vector3(cvLength / 4, 0, cvWidth / 3.2)   // Cocheira 4
    ];
    
    for (let i = 0; i < Math.min(numHorses, positions.length); i++) {
      const pos = positions[i];
      const coat = this.coats[i % this.coats.length];
      
      const horseGroup = new THREE.Group();
      horseGroup.position.copy(pos);
      // Rotação inicial dependendo de qual lado do corredor
      horseGroup.rotation.y = pos.z < 0 ? 0 : Math.PI; 
      // Leve desvio aleatório
      horseGroup.rotation.y += Math.random() * 0.5 - 0.25;
      
      this.buildRealisticHorse(horseGroup, coat);
      this.group.add(horseGroup);
      this.horses.push(horseGroup);
      
      // Anel de conforto (halo)
      const ringGeo = new THREE.RingGeometry(1.2, 1.3, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: this.colorComfort,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const halo = new THREE.Mesh(ringGeo, ringMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(pos.x, 0.05, pos.z);
      this.group.add(halo);
      this.comfortHalos.push(halo);
    }
  }
  
  /**
   * Constrói o cavalo com proporções reais e malha orgânica refinada
   */
  private buildRealisticHorse(parent: THREE.Group, coat: HorseCoat): void {
    // 1. Materiais Físicos de Alta Qualidade (Pelo, Crina, Casco, Olho)
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: coat.bodyColor,
      roughness: coat.roughness,
      metalness: coat.metalness,
      clearcoat: coat.clearcoat,
      clearcoatRoughness: 0.4,
      sheen: 1.0,
      sheenRoughness: 0.6,
      sheenColor: coat.sheenColor,
      bumpMap: this.furBumpMap,
      bumpScale: 0.015 // Relevo muito suave de pelos
    });
    
    // Pernas escuras (no Baio, as canelas são pretas)
    const legMaterial = coat.blackLegs 
      ? new THREE.MeshPhysicalMaterial({
          color: 0x18181b,
          roughness: 0.5,
          metalness: 0.1,
          clearcoat: 0.3,
          bumpMap: this.furBumpMap,
          bumpScale: 0.015
        })
      : bodyMaterial;
      
    const maneMaterial = new THREE.MeshStandardMaterial({
      color: coat.maneColor,
      roughness: 0.85
    });
    
    const hoofMaterial = new THREE.MeshStandardMaterial({
      color: coat.hoofColor,
      roughness: 0.25,
      metalness: 0.6 // Casco queratina brilha
    });
    
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: coat.eyeColor,
      roughness: 0.0,
      metalness: 0.9 // Globo ocular reflexivo
    });
    
    // --- GEOMETRIA ANATÔMICA REFINADA (Muscular/Low-Poly) ---
    
    // 2. Tronco Muscular (Composto por Peito, Barriga e Garupa)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.25; // Altura central
    
    // Peito / Ombros (Esférico / Robusto)
    const chestGeo = new THREE.SphereGeometry(0.36, 12, 12);
    const chest = new THREE.Mesh(chestGeo, bodyMaterial);
    chest.scale.set(1.0, 1.2, 1.0);
    chest.position.set(0, 0, 0.4);
    chest.castShadow = true;
    chest.receiveShadow = true;
    torsoGroup.add(chest);
    
    // Barriga (Ligeiramente flácida/esférica no centro)
    const bellyGeo = new THREE.SphereGeometry(0.38, 12, 12);
    const belly = new THREE.Mesh(bellyGeo, bodyMaterial);
    belly.scale.set(1.0, 1.0, 1.4);
    belly.position.set(0, -0.05, 0.0);
    belly.castShadow = true;
    belly.receiveShadow = true;
    torsoGroup.add(belly);
    
    // Garupa / Quadris (Hips - Larga e musculosa)
    const hipsGeo = new THREE.SphereGeometry(0.38, 12, 12);
    const hips = new THREE.Mesh(hipsGeo, bodyMaterial);
    hips.scale.set(1.1, 1.15, 1.0);
    hips.position.set(0, 0.04, -0.42);
    hips.castShadow = true;
    hips.receiveShadow = true;
    torsoGroup.add(hips);
    
    parent.add(torsoGroup);
    
    // 3. Pescoço Esbelto e Inclinado (Tapered Cylinder)
    const neckGroup = new THREE.Group();
    // Posiciona pescoço no ombro
    neckGroup.position.set(0, 1.4, 0.52);
    neckGroup.rotation.x = -0.58; // Inclinação natural do pescoço
    
    const neckGeo = new THREE.CylinderGeometry(0.14, 0.22, 0.75, 8);
    const neck = new THREE.Mesh(neckGeo, bodyMaterial);
    neck.position.y = 0.35; // Desloca para rotacionar da base
    neck.castShadow = true;
    neck.receiveShadow = true;
    neckGroup.add(neck);
    
    // Crina Cascateando (Mane)
    const maneGeo = new THREE.BoxGeometry(0.06, 0.7, 0.16);
    const mane = new THREE.Mesh(maneGeo, maneMaterial);
    mane.position.set(0, 0.35, -0.16);
    neckGroup.add(mane);
    
    // 4. Cabeça Detalhada (Cheeks + Muzzle) no topo do pescoço
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.7, 0.05); // Topo do pescoço
    headGroup.rotation.x = 0.88; // Ângulo da cabeça em relação ao pescoço
    
    // Ganachas / Bochechas (Mandíbula circular)
    const jawGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const jaw = new THREE.Mesh(jawGeo, bodyMaterial);
    jaw.scale.set(0.9, 1.0, 1.1);
    jaw.position.set(0, 0, -0.05);
    jaw.castShadow = true;
    headGroup.add(jaw);
    
    // Focinho / Chanfro (tapered box)
    const muzzleGeo = new THREE.BoxGeometry(0.16, 0.18, 0.4);
    const muzzle = new THREE.Mesh(muzzleGeo, bodyMaterial);
    muzzle.position.set(0, -0.05, 0.22);
    muzzle.castShadow = true;
    headGroup.add(muzzle);
    
    // Olhos brilhantes laterais
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMaterial);
    eyeL.position.set(-0.13, 0.06, 0.08);
    headGroup.add(eyeL);
    
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;
    headGroup.add(eyeR);
    
    // Orelhas pontudas
    const earGeo = new THREE.ConeGeometry(0.04, 0.18, 4);
    const earL = new THREE.Mesh(earGeo, bodyMaterial);
    earL.position.set(-0.08, 0.14, -0.1);
    earL.rotation.z = 0.15;
    earL.castShadow = true;
    headGroup.add(earL);
    
    const earR = earL.clone();
    earR.position.x = 0.08;
    earR.rotation.z = -0.15;
    headGroup.add(earR);
    
    neckGroup.add(headGroup);
    parent.add(neckGroup);
    this.necks.push(neckGroup as unknown as THREE.Mesh); // Salva para micro-animação
    
    // 5. Pernas Articuladas e Cascos (4 Pernas)
    // Pernas dianteiras (Ombro + Coxa + Canela + Casco)
    const createLeg = (xSign: number, zSign: number): THREE.Group => {
      const legGroup = new THREE.Group();
      // Posição de origem da perna
      const legX = xSign * 0.22;
      const legZ = zSign * 0.42;
      legGroup.position.set(legX, 1.25, legZ);
      
      // Articulação superior (Muscular)
      const thighGeo = new THREE.BoxGeometry(0.15, 0.5, 0.18);
      const thigh = new THREE.Mesh(thighGeo, zSign > 0 ? bodyMaterial : legMaterial);
      thigh.position.y = -0.25;
      thigh.castShadow = true;
      legGroup.add(thigh);
      
      // Canela (Fina)
      const shinGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.6, 8);
      const shin = new THREE.Mesh(shinGeo, legMaterial);
      shin.position.y = -0.8;
      shin.castShadow = true;
      legGroup.add(shin);
      
      // Casco (Queratina brilhante)
      const hoofGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.15, 10);
      const hoof = new THREE.Mesh(hoofGeo, hoofMaterial);
      hoof.position.y = -1.175;
      hoof.castShadow = true;
      legGroup.add(hoof);
      
      return legGroup;
    };
    
    parent.add(createLeg(-1, 1));  // Dianteira Esquerda
    parent.add(createLeg(1, 1));   // Dianteira Direita
    parent.add(createLeg(-1, -1)); // Traseira Esquerda
    parent.add(createLeg(1, -1));  // Traseira Direita
    
    // 6. Cauda Segmentada Animada (Tail)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.2, -0.8);
    tailGroup.rotation.x = -0.4; // Inclinação natural para trás
    
    // Malha da cauda (Cilindro macio que afunila)
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.9, 8);
    const tailMesh = new THREE.Mesh(tailGeo, maneMaterial);
    tailMesh.position.y = -0.4;
    tailMesh.castShadow = true;
    tailGroup.add(tailMesh);
    
    parent.add(tailGroup);
    this.tails.push(tailGroup as unknown as THREE.Mesh); // Salva para animação de abano
  }
  
  /**
   * Atualiza a cor dos halos de conforto e pequenas micro-animações realistas
   * @param temp Temperatura interna atual
   * @param rh Umidade relativa interna atual
   * @param time Tempo transcorrido
   */
  public update(temp: number, rh: number, time: number): void {
    const comfort = getEquineComfortIndex(temp, rh);
    
    let targetColor = this.colorComfort;
    let isPulsing = false;
    
    if (comfort.status === 'WARNING') {
      targetColor = this.colorWarning;
    } else if (comfort.status === 'DANGER') {
      targetColor = this.colorDanger;
      isPulsing = true;
    }
    
    // 1. Atualizar a cor e intensidade dos anéis de conforto
    this.comfortHalos.forEach(halo => {
      const mat = halo.material as THREE.MeshBasicMaterial;
      mat.color.lerp(targetColor, 0.1);
      
      if (isPulsing) {
        mat.opacity = 0.35 + 0.35 * Math.sin(time * 8.0);
        const scale = 1.0 + 0.05 * Math.sin(time * 8.0);
        halo.scale.set(scale, scale, 1.0);
      } else {
        mat.opacity = 0.8;
        halo.scale.set(1.0, 1.0, 1.0);
      }
    });
    
    // 2. Executar micro-animações nos cavalos
    this.horses.forEach((horse, index) => {
      const offsetTime = time + index * 12.5;
      
      // a) Respiração (Expansão e contração sutil do Torso)
      // O torso é o primeiro grupo adicionado (ombros, barriga, garupa)
      // horse.children[0] é o torsoGroup
      const torso = horse.children[0];
      if (torso) {
        // Respiração acelera se o cavalo estiver em estresse por calor
        const breatheSpeed = isPulsing ? 3.5 : 1.2;
        const breathingFactor = 1.0 + 0.012 * Math.sin(offsetTime * breatheSpeed);
        torso.scale.set(1.0, breathingFactor, 1.0);
      }
      
      // b) Movimento de abanar a cauda (Tail wagging)
      // O último elemento adicionado ao cavalo é o grupo da cauda
      const tail = this.tails[index];
      if (tail) {
        // Balanço lateral sutil (eixo Z) e traseiro (eixo X)
        // Se estiver muito calor, a cauda abana mais rápido (tentativa de afastar moscas/estresse)
        const swaySpeed = isPulsing ? 8.0 : 2.0;
        const swayWidth = isPulsing ? 0.4 : 0.15;
        tail.rotation.z = Math.sin(offsetTime * swaySpeed) * swayWidth;
        tail.rotation.x = -0.4 + Math.cos(offsetTime * 0.8) * 0.05;
      }
      
      // c) Movimento sutil da cabeça e pescoço (curiosidade/olhar)
      const neck = this.necks[index];
      if (neck) {
        // Movimento vertical do pescoço simulando o cavalo farejando ou relaxando
        neck.rotation.x = -0.58 + Math.sin(offsetTime * 0.4) * 0.04;
        // Pequena torção lateral do pescoço
        neck.rotation.y = Math.sin(offsetTime * 0.2) * 0.05;
      }
      
      // d) Pequenas oscilações nas pernas (Stance shifts)
      // Pernas são as crianças indexadas de 2 a 5
      for (let legIdx = 2; legIdx <= 5; legIdx++) {
        const leg = horse.children[legIdx];
        if (leg) {
          // Pequena perturbação de posição para simular mudança de peso nas patas
          const legOffset = offsetTime + legIdx * 5.0;
          leg.rotation.x = Math.sin(legOffset * 0.1) * 0.02;
        }
      }
    });
  }
}
