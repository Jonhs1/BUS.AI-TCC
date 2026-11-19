import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type Estado = {
  dia: string;
  totalDia: number;
  porUsuario: Record<string, number>;
  janelas: Record<string, { inicio: number; total: number }>;
};

export type ResultadoReserva =
  | { permitido: true; liberar: () => void }
  | { permitido: false; motivo: string };

// Cotas conservadoras por INSTÂNCIA. A chave precisa continuar em um projeto sem faturamento.
export const LIMITES_IA = Object.freeze({
  totalDia: 20,
  porUsuarioDia: 6,
  porUsuario15Min: 3,
  simultaneas: 2,
});

export class LimitadorIA {
  private emAndamento = 0;

  constructor(private readonly arquivo: string, private readonly relogio: () => number = Date.now) {}

  reservar(usuarioId: number): ResultadoReserva {
    if (this.emAndamento >= LIMITES_IA.simultaneas) {
      return { permitido: false, motivo: "A IA está ocupada com outras consultas. Tente novamente em instantes." };
    }

    // Falha fechada: se o arquivo não puder ser lido/escrito, NÃO consulta o fornecedor.
    const agora = this.relogio();
    const dia = new Date(agora).toISOString().slice(0, 10);
    const estado = this.ler(dia);
    const chave = String(usuarioId);
    const janela = estado.janelas[chave];
    const totalJanela = janela && agora - janela.inicio < 15 * 60_000 ? janela.total : 0;

    if (estado.totalDia >= LIMITES_IA.totalDia) {
      return { permitido: false, motivo: "Cota diária do assistente esgotada. Volte amanhã." };
    }
    if ((estado.porUsuario[chave] ?? 0) >= LIMITES_IA.porUsuarioDia) {
      return { permitido: false, motivo: "Você atingiu sua cota diária de consultas à IA. Volte amanhã." };
    }
    if (totalJanela >= LIMITES_IA.porUsuario15Min) {
      return { permitido: false, motivo: "Você atingiu o limite de 3 perguntas em 15 minutos. Aguarde um pouco." };
    }

    estado.totalDia++;
    estado.porUsuario[chave] = (estado.porUsuario[chave] ?? 0) + 1;
    estado.janelas[chave] = { inicio: totalJanela ? janela!.inicio : agora, total: totalJanela + 1 };

    // Reserva é persistida ANTES do envio para o Gemini. Até erros do fornecedor contam,
    // intencionalmente: nunca deixar uma falha gerar tentativas ilimitadas.
    this.salvar(estado);
    this.emAndamento++;
    let liberada = false;
    return {
      permitido: true,
      liberar: () => {
        if (!liberada) {
          this.emAndamento--;
          liberada = true;
        }
      },
    };
  }

  private ler(dia: string): Estado {
    let conteudo: string;
    try {
      conteudo = readFileSync(this.arquivo, "utf8");
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === "ENOENT") {
        return { dia, totalDia: 0, porUsuario: {}, janelas: {} };
      }
      throw erro;
    }
    const valor: unknown = JSON.parse(conteudo);
    if (!valor || typeof valor !== "object" || !("dia" in valor) || typeof valor.dia !== "string") {
      throw new Error("Estado das cotas de IA inválido");
    }
    if (valor.dia !== dia) return { dia, totalDia: 0, porUsuario: {}, janelas: {} };
    if (!("totalDia" in valor) || !Number.isSafeInteger(valor.totalDia) ||
        !("porUsuario" in valor) || !valor.porUsuario || typeof valor.porUsuario !== "object" ||
        !("janelas" in valor) || !valor.janelas || typeof valor.janelas !== "object") {
      throw new Error("Estado das cotas de IA corrompido");
    }
    return valor as Estado;
  }

  private salvar(estado: Estado) {
    mkdirSync(dirname(this.arquivo), { recursive: true });
    const temporario = this.arquivo + ".tmp";
    writeFileSync(temporario, JSON.stringify(estado), { encoding: "utf8", mode: 0o600 });
    renameSync(temporario, this.arquivo);
  }
}
