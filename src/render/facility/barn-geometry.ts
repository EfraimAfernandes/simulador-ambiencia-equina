import * as THREE from 'three';
import { ControlVolume } from '../../sim/state/control-volume.ts';

export class BarnGeometry {
  public group: THREE.Group;
  
  // Elementos animados / dinâmicos / configuráveis
  private leftCurtain: THREE.Mesh | null = null;
  private rightCurtain: THREE.Mesh | null = null;
  private ceilingMesh: THREE.Mesh | null = null;
  
  // Elementos estáticos e materiais
  private cvOutline: THREE.LineSegments | null = null;
  private structuralMaterial: THREE.MeshStandardMaterial;
  
  constructor(cv: ControlVolume) {
    this.group = new THREE.Group();
    
    // Estrutura pintada de creme claro, alegre e premium
    this.structuralMaterial = new THREE.MeshStandardMaterial({
      color: 0xfaf7f2, // Cream pintado limpo
      roughness: 0.5,
      metalness: 0.1
    });
    
    this.buildBarn(cv);
  }
  
  /**
   * Constrói todas as partes geométricas da instalação
   */
  private buildBarn(cv: ControlVolume): void {
    const { length: L, width: W, height: H } = cv.config;
    
    // 1. Linha do Volume de Controle (Dashed Cyan Box)
    const cvBoxGeo = new THREE.BoxGeometry(L, H, W);
    const cvEdges = new THREE.EdgesGeometry(cvBoxGeo);
    const cvLineMat = new THREE.LineDashedMaterial({
      color: 0x06b6d4, // Cyan
      dashSize: 0.5,
      gapSize: 0.3,
      linewidth: 2
    });
    
    this.cvOutline = new THREE.LineSegments(cvEdges, cvLineMat);
    this.cvOutline.computeLineDistances();
    this.cvOutline.position.set(0, H / 2, 0);
    this.group.add(this.cvOutline);
    
    // 2. Pilares de suporte (cantos e intermediários)
    const pilarGeo = new THREE.BoxGeometry(0.3, H, 0.3);
    const pilarPositions = [
      [-L/2, H/2, -W/2],
      [L/2, H/2, -W/2],
      [-L/2, H/2, W/2],
      [L/2, H/2, W/2],
      [-L/2, H/2, 0], // Intermediários
      [L/2, H/2, 0]
    ];
    
    pilarPositions.forEach(([x, y, z]) => {
      const pilar = new THREE.Mesh(pilarGeo, this.structuralMaterial);
      pilar.position.set(x, y, z);
      pilar.castShadow = true;
      pilar.receiveShadow = true;
      this.group.add(pilar);
    });
    
    // 3. Meia-Parede inferior (Alvenaria de 1 metro)
    const wallH = 1.0;
    const wallThick = 0.2;
    const backWallGeo = new THREE.BoxGeometry(L, wallH, wallThick);
    const backWall = new THREE.Mesh(backWallGeo, this.structuralMaterial);
    backWall.position.set(0, wallH / 2, -W / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    this.group.add(backWall);
    
    const frontWall = backWall.clone();
    frontWall.position.set(0, wallH / 2, W / 2);
    this.group.add(frontWall);
    
    // Paredes laterais (Esquerda / Direita) com aberturas de ventilação
    const sideWallGeo = new THREE.BoxGeometry(wallThick, wallH, W);
    const leftWall = new THREE.Mesh(sideWallGeo, this.structuralMaterial);
    leftWall.position.set(-L / 2, wallH / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.group.add(leftWall);
    
    const rightWall = leftWall.clone();
    rightWall.position.set(L / 2, wallH / 2, 0);
    this.group.add(rightWall);
    
    // 4. Divisórias das Baias (Cocheiras) - Madeira clara cor de mel
    const partitionGeo = new THREE.BoxGeometry(0.1, 1.8, W * 0.4);
    const partitionMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Honey oak / Amber wood
      roughness: 0.6
    });
    
    const numPartitions = 3;
    for (let i = 0; i < numPartitions; i++) {
      const xPos = -L / 3 + (i * L / 3);
      if (Math.abs(xPos) > L / 2 - 0.5) continue;
      
      // Divisória lado esquerdo (Z negativo)
      const partLeft = new THREE.Mesh(partitionGeo, partitionMaterial);
      partLeft.position.set(xPos, 1.8 / 2, -W / 4);
      partLeft.castShadow = true;
      partLeft.receiveShadow = true;
      this.group.add(partLeft);
      
      // Divisória lado direito (Z positivo)
      const partRight = partLeft.clone();
      partRight.position.set(xPos, 1.8 / 2, W / 4);
      this.group.add(partRight);
    }
    
    // 5. Portões e divisórias frontais das baias
    const frontPartGeo = new THREE.BoxGeometry(L * 0.8, 1.4, 0.1);
    const partFrontLeft = new THREE.Mesh(frontPartGeo, partitionMaterial);
    partFrontLeft.position.set(0, 1.4 / 2, -W * 0.15);
    partFrontLeft.castShadow = true;
    this.group.add(partFrontLeft);
    
    const partFrontRight = partFrontLeft.clone();
    partFrontRight.position.set(0, 1.4 / 2, W * 0.15);
    this.group.add(partFrontRight);
    
    // 6. Janelas / Cortinas Laterais móveis
    const curtainH = H - wallH;
    const curtainW = W * 0.98;
    const curtainGeo = new THREE.BoxGeometry(0.05, curtainH, curtainW);
    const curtainMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Branco cortina claro
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    
    this.leftCurtain = new THREE.Mesh(curtainGeo, curtainMaterial);
    this.leftCurtain.position.set(-L/2, wallH + curtainH/2, 0);
    this.group.add(this.leftCurtain);
    
    this.rightCurtain = this.leftCurtain.clone() as THREE.Mesh;
    this.rightCurtain.position.set(L/2, wallH + curtainH/2, 0);
    this.group.add(this.rightCurtain);
    
    // 7. Cobertura (Telhado translúcido de duas águas azul celeste)
    const roofSlope = 0.25;
    const roofOverhang = 0.5;
    const roofHalfW = (W / 2) + roofOverhang;
    const roofH = roofHalfW * roofSlope;
    const roofThick = 0.08;
    
    const roofSheetGeo = new THREE.BoxGeometry(L + 0.4, roofThick, roofHalfW);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc, // Azul celeste translúcido brilhante
      transparent: true,
      opacity: 0.35,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const angle = Math.atan(roofSlope);
    
    const roofLeft = new THREE.Mesh(roofSheetGeo, roofMaterial);
    roofLeft.rotation.x = angle;
    roofLeft.position.set(0, H + roofH / 2, roofHalfW / 2 - roofOverhang / 2);
    roofLeft.castShadow = true;
    roofLeft.receiveShadow = true;
    this.group.add(roofLeft);
    
    const roofRight = new THREE.Mesh(roofSheetGeo, roofMaterial);
    roofRight.rotation.x = -angle;
    roofRight.position.set(0, H + roofH / 2, -roofHalfW / 2 + roofOverhang / 2);
    roofRight.castShadow = true;
    roofRight.receiveShadow = true;
    this.group.add(roofRight);
    
    // Forro / Teto isolante (teto plano em H para o preset Premium Isolado)
    const ceilingGeo = new THREE.BoxGeometry(L + 0.2, 0.06, W + 0.2);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Placa de poliuretano branca
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    this.ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
    this.ceilingMesh.position.set(0, H, 0);
    this.ceilingMesh.visible = false; // Oculto por padrão (Tradicional Quente)
    this.group.add(this.ceilingMesh);

    // Lanternim (Abertura de ventilação na cumeeira para o preset Tradicional)
    const ridgeCapGeo = new THREE.BoxGeometry(L + 0.4, 0.04, 0.8);
    const ridgeCap = new THREE.Mesh(ridgeCapGeo, roofMaterial);
    ridgeCap.position.set(0, H + roofH + 0.15, 0);
    this.group.add(ridgeCap);

    const supportGeo = new THREE.BoxGeometry(0.1, 0.15, 0.6);
    for (let i = 0; i < 4; i++) {
      const x = -L/2 + (i * L / 3);
      const support = new THREE.Mesh(supportGeo, this.structuralMaterial);
      support.position.set(x, H + roofH + 0.075, 0);
      this.group.add(support);
    }
    
    // Vigas da cobertura (Vigas verdes típicas zootécnicas premium)
    const trussMaterial = new THREE.MeshStandardMaterial({
      color: 0x166534, // Verde floresta alegre
      roughness: 0.5
    });
    const trussGeo = new THREE.BoxGeometry(0.1, 0.15, W);
    const truss = new THREE.Mesh(trussGeo, trussMaterial);
    truss.position.set(0, H, 0);
    this.group.add(truss);
    
    // 8. Elementos Adicionais da Fase 5
    this.buildAccessDoors(L, W, H);
    this.buildAccessPaths();
    this.buildTrees();
  }
  
  /**
   * Altera a visibilidade da cobertura/forro conforme o preset
   */
  public setStructuralPreset(preset: 'traditional' | 'premium'): void {
    if (this.ceilingMesh) {
      this.ceilingMesh.visible = (preset === 'premium');
    }
  }
  
  /**
   * Constrói as portas deslizantes de estábulo
   */
  private buildAccessDoors(L: number, _W: number, _H: number): void {
    const doorWoodMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, // Laranja/Marrom madeira quente
      roughness: 0.7
    });
    const doorMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Ferro fundido preto
      roughness: 0.5,
      metalness: 0.8
    });
    
    const portals = [-L/2, L/2];
    
    portals.forEach(x => {
      // Postes verticais do portal
      const postGeo = new THREE.BoxGeometry(0.2, 2.5, 0.2);
      
      const postLeft = new THREE.Mesh(postGeo, this.structuralMaterial);
      postLeft.position.set(x, 2.5/2, -1.25);
      postLeft.castShadow = true;
      postLeft.receiveShadow = true;
      this.group.add(postLeft);
      
      const postRight = new THREE.Mesh(postGeo, this.structuralMaterial);
      postRight.position.set(x, 2.5/2, 1.25);
      postRight.castShadow = true;
      postRight.receiveShadow = true;
      this.group.add(postRight);
      
      // Viga superior
      const headerGeo = new THREE.BoxGeometry(0.2, 0.2, 2.7);
      const header = new THREE.Mesh(headerGeo, this.structuralMaterial);
      header.position.set(x, 2.5 + 0.1, 0);
      header.castShadow = true;
      this.group.add(header);
      
      // Trilho de correr
      const railGeo = new THREE.BoxGeometry(0.25, 0.05, 3.2);
      const rail = new THREE.Mesh(railGeo, doorMetalMat);
      rail.position.set(x * 1.01, 2.5 - 0.05, 0);
      this.group.add(rail);
      
      // Porta deslizante esquerda (parcialmente aberta)
      const doorPanelGeo = new THREE.BoxGeometry(0.06, 2.3, 1.1);
      const door1 = new THREE.Mesh(doorPanelGeo, doorWoodMat);
      door1.position.set(x * 1.02, 2.3/2, -0.95);
      door1.castShadow = true;
      this.group.add(door1);
      
      // Molduras em X pretas clássicas de celeiro
      const braceGeo = new THREE.BoxGeometry(0.08, 2.3, 0.08);
      const brace1 = new THREE.Mesh(braceGeo, doorMetalMat);
      brace1.rotation.x = Math.PI / 4;
      brace1.position.set(x * 1.025, 2.3/2, -0.95);
      this.group.add(brace1);
      
      // Porta deslizante direita (parcialmente aberta)
      const door2 = new THREE.Mesh(doorPanelGeo, doorWoodMat);
      door2.position.set(x * 1.02, 2.3/2, 0.95);
      door2.castShadow = true;
      this.group.add(door2);
      
      const brace2 = new THREE.Mesh(braceGeo, doorMetalMat);
      brace2.rotation.x = -Math.PI / 4;
      brace2.position.set(x * 1.025, 2.3/2, 0.95);
      this.group.add(brace2);
    });
  }
  
  /**
   * Constrói os caminhos/vias no solo
   */
  private buildAccessPaths(): void {
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0xddc3a5, // Areia clara/Cascalho
      roughness: 0.9
    });
    
    // Via principal cruzando o corredor do estábulo de ponta a ponta
    const pathGeo = new THREE.PlaneGeometry(60, 2.2);
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.005, 0);
    path.receiveShadow = true;
    this.group.add(path);
    
    // Pátio circular ao redor da instalação
    const loopGeo = new THREE.RingGeometry(18, 20.2, 32);
    const loopMat = new THREE.MeshStandardMaterial({
      color: 0xd1bb9e,
      roughness: 0.9
    });
    const loop = new THREE.Mesh(loopGeo, loopMat);
    loop.rotation.x = -Math.PI / 2;
    loop.position.set(0, 0.004, 0);
    loop.receiveShadow = true;
    this.group.add(loop);
  }
  
  /**
   * Constrói árvores decorativas ao lado da instalação
   */
  private buildTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033, // Tronco marrom escuro
      roughness: 0.9
    });
    
    const leavesColor1 = new THREE.Color(0x22c55e); // Verde vivo alegre
    const leavesColor2 = new THREE.Color(0x16a34a); // Verde médio
    const leavesColor3 = new THREE.Color(0x15803d); // Verde escuro
    
    const treePositions = [
      { x: -9, z: -8, scale: 1.0 },
      { x: -11, z: 7, scale: 1.25 },
      { x: 9, z: -7, scale: 0.95 },
      { x: 11, z: 8, scale: 1.15 }
    ];
    
    treePositions.forEach(pos => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(pos.x, 0, pos.z);
      treeGroup.scale.set(pos.scale, pos.scale, pos.scale);
      
      // Tronco
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 3.5, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.5 / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);
      
      // Copa esférica em degradê
      const f1Mat = new THREE.MeshStandardMaterial({ color: leavesColor3, roughness: 0.8 });
      const f1Geo = new THREE.SphereGeometry(1.4, 8, 8);
      const f1 = new THREE.Mesh(f1Geo, f1Mat);
      f1.position.y = 2.8;
      f1.castShadow = true;
      treeGroup.add(f1);
      
      const f2Mat = new THREE.MeshStandardMaterial({ color: leavesColor2, roughness: 0.8 });
      const f2Geo = new THREE.SphereGeometry(1.1, 8, 8);
      const f2 = new THREE.Mesh(f2Geo, f2Mat);
      f2.position.y = 3.9;
      f2.castShadow = true;
      treeGroup.add(f2);
      
      const f3Mat = new THREE.MeshStandardMaterial({ color: leavesColor1, roughness: 0.8 });
      const f3Geo = new THREE.SphereGeometry(0.8, 8, 8);
      const f3 = new THREE.Mesh(f3Geo, f3Mat);
      f3.position.y = 4.8;
      f3.castShadow = true;
      treeGroup.add(f3);
      
      this.group.add(treeGroup);
    });
  }
  
  /**
   * Atualiza as animações e os estados das cortinas
   */
  public update(openingRatio: number, _dt: number): void {
    const { height: H } = { height: 4.5 };
    const wallH = 1.0;
    const curtainH = H - wallH;
    
    const targetScaleY = 1.0 - openingRatio;
    const targetPosY = wallH + curtainH/2 + (curtainH/2 * openingRatio);
    
    if (this.leftCurtain && this.rightCurtain) {
      this.leftCurtain.scale.y = THREE.MathUtils.lerp(this.leftCurtain.scale.y, targetScaleY, 0.1);
      this.leftCurtain.position.y = THREE.MathUtils.lerp(this.leftCurtain.position.y, targetPosY, 0.1);
      
      this.rightCurtain.scale.y = THREE.MathUtils.lerp(this.rightCurtain.scale.y, targetScaleY, 0.1);
      this.rightCurtain.position.y = THREE.MathUtils.lerp(this.rightCurtain.position.y, targetPosY, 0.1);
    }
  }
}
