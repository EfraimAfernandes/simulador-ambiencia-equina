export interface ChartConfig {
  maxDataPoints: number;
  labelY: string;
  minVal: number;
  maxVal: number;
  color1: string; // Cor da linha 1 (Interna / Real)
  color2: string; // Cor da linha 2 (Externa / Medido)
  color3?: string; // Cor da linha 3 (Filtrado) - Opcional
}

export class CanvasChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: ChartConfig;
  
  private history1: number[] = [];
  private history2: number[] = [];
  private history3: number[] = [];
  
  constructor(canvasId: string, config: ChartConfig) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas com ID '${canvasId}' não encontrado.`);
    }
    this.canvas = canvas;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(`Não foi possível obter o Contexto 2D para o canvas '${canvasId}'.`);
    }
    this.ctx = context;
    this.config = config;
    
    // Ajustar tamanho real baseado no CSS para evitar pixelização
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }
  
  /**
   * Ajusta os atributos de largura/altura internos para corresponder ao CSS do contêiner
   */
  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.draw();
  }
  
  /**
   * Adiciona um novo trio de dados ao histórico
   */
  public addData(val1: number, val2: number, val3?: number): void {
    this.history1.push(val1);
    this.history2.push(val2);
    if (val3 !== undefined) {
      this.history3.push(val3);
    }
    
    if (this.history1.length > this.config.maxDataPoints) {
      this.history1.shift();
      this.history2.shift();
      if (this.history3.length > 0) {
        this.history3.shift();
      }
    }
    
    this.draw();
  }
  
  /**
   * Reseta o histórico do gráfico
   */
  public clear(): void {
    this.history1 = [];
    this.history2 = [];
    this.history3 = [];
    this.draw();
  }
  
  /**
   * Redesenha o gráfico completo com eixos, grades e linhas de dados
   */
  public draw(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    
    // Limpar
    ctx.clearRect(0, 0, w, h);
    
    if (w === 0 || h === 0) return;
    
    // Definição de margens (paddings) escaladas pelo DPR
    const paddingLeft = 45 * dpr;
    const paddingRight = 15 * dpr;
    const paddingTop = 20 * dpr;
    const paddingBottom = 20 * dpr;
    
    const graphWidth = w - paddingLeft - paddingRight;
    const graphHeight = h - paddingTop - paddingBottom;
    
    // 1. Desenhar a Grade de Fundo (Grid Lines)
    const numGridLines = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1 * dpr;
    ctx.fillStyle = '#64748b'; // Slate-400 para textos
    ctx.font = `${10 * dpr}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= numGridLines; i++) {
      // Interpolação do valor no eixo Y
      const ratio = i / numGridLines;
      const yValue = this.config.maxVal - ratio * (this.config.maxVal - this.config.minVal);
      const yPos = paddingTop + ratio * graphHeight;
      
      // Desenha linha pontilhada horizontal
      ctx.beginPath();
      ctx.setLineDash([5 * dpr, 5 * dpr]);
      ctx.moveTo(paddingLeft, yPos);
      ctx.lineTo(w - paddingRight, yPos);
      ctx.stroke();
      ctx.setLineDash([]); // Reset
      
      // Texto da escala Y
      ctx.fillText(`${yValue.toFixed(0)}${this.config.labelY}`, paddingLeft - 8 * dpr, yPos);
    }
    
    // Eixo X de base
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(paddingLeft, h - paddingBottom);
    ctx.lineTo(w - paddingRight, h - paddingBottom);
    ctx.stroke();
    
    // Se não houver dados ainda, exibe texto informativo
    if (this.history1.length === 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Aguardando dados...', paddingLeft + graphWidth / 2, paddingTop + graphHeight / 2);
      return;
    }
    
    // 2. Plotar a Linha 2 (Externa / Medido)
    this.plotLine(this.history2, this.config.color2, paddingLeft, paddingTop, graphWidth, graphHeight, dpr);
    
    // 3. Plotar a Linha 1 (Interna / Real)
    this.plotLine(this.history1, this.config.color1, paddingLeft, paddingTop, graphWidth, graphHeight, dpr);

    // 4. Plotar a Linha 3 (Filtrada) se definida
    if (this.config.color3 && this.history3.length > 0) {
      this.plotLine(this.history3, this.config.color3, paddingLeft, paddingTop, graphWidth, graphHeight, dpr);
    }
  }
  
  /**
   * Helper que traça e colore uma linha de histórico
   */
  private plotLine(
    history: number[],
    color: string,
    xOffset: number,
    yOffset: number,
    gWidth: number,
    gHeight: number,
    dpr: number
  ): void {
    const ctx = this.ctx;
    const len = history.length;
    const maxPts = this.config.maxDataPoints;
    const minVal = this.config.minVal;
    const maxVal = this.config.maxVal;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * dpr;
    
    // Aplicar efeito de brilho neon leve
    ctx.shadowBlur = 6 * dpr;
    ctx.shadowColor = color;
    
    ctx.beginPath();
    
    for (let i = 0; i < len; i++) {
      // Mapeamento linear de X: distribui os pontos de 0 até o final do gráfico
      const xRatio = i / (maxPts - 1);
      const x = xOffset + xRatio * gWidth;
      
      // Mapeamento linear de Y
      const val = Math.max(minVal, Math.min(maxVal, history[i]));
      const yRatio = (val - minVal) / (maxVal - minVal);
      const y = xOffset + gHeight + yOffset - yRatio * gHeight - xOffset; // Ajuste correto da altura invertida
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Resetar sombra para não borrar outros elementos de texto ou grades
    ctx.shadowBlur = 0;
  }
}
