import { minutosDeCaminhada, type Ponto } from "../lib/geo";

// Minutos de segurança somados a toda atividade (estimativa declarada)
export const MARGEM_SEGURANCA_MIN = 5;

// Pesos da pontuação (somam 1)
export const PESO_APROVEITAMENTO = 0.6;
export const PESO_PROXIMIDADE = 0.4;

export interface CompromissoDoDia {
  titulo: string;
  inicioMin: number;
  fimMin: number;
  local: Ponto | null;
}

export interface AtividadeCandidata {
  id: number;
  titulo: string;
  categoria: string;
  duracaoMin: number;
  abreMin: number | null;
  fechaMin: number | null;
  localNome: string;
  local: Ponto;
}

export interface Janela {
  inicioMin: number;
  fimMin: number;
  minutos: number;
  anterior: CompromissoDoDia | null; // compromisso que acabou (ou está acabando)
  proximo: CompromissoDoDia; // compromisso que limita a janela
}

export interface Recomendacao {
  atividade: AtividadeCandidata;
  idaMin: number;
  voltaMin: number;
  totalMin: number;
  folgaMin: number;
  pontuacao: number;
  justificativa: string;
}

export interface Descartada {
  atividade: AtividadeCandidata;
  motivo: string;
}

export interface ResultadoRecomendacao {
  janela: Janela | null;
  recomendacoes: Recomendacao[];
  descartadas: Descartada[];
}

// PASSO 1: encontra o intervalo livre entre agora e o próximo compromisso do dia
export function calcularJanela(agoraMin: number, compromissos: CompromissoDoDia[]): Janela | null {
  const ordenados = [...compromissos].sort((a, b) => a.inicioMin - b.inicioMin);

  // Se o aluno está em aula agora, a janela só começa quando ela terminar
  const atual = ordenados.find((c) => c.inicioMin <= agoraMin && agoraMin < c.fimMin);
  const inicioMin = atual ? atual.fimMin : agoraMin;

  const proximo = ordenados.find((c) => c.inicioMin >= inicioMin);
  if (!proximo) return null;

  // Último compromisso que terminou até o início da janela (onde o aluno provavelmente está)
  const anteriores = ordenados.filter((c) => c.fimMin <= inicioMin);
  const anterior = anteriores.length > 0 ? anteriores[anteriores.length - 1] : null;

  return {
    inicioMin,
    fimMin: proximo.inicioMin,
    minutos: proximo.inicioMin - inicioMin,
    anterior,
    proximo,
  };
}

export function recomendar(
  agoraMin: number,
  posicaoAtual: Ponto | null,
  compromissosDoDia: CompromissoDoDia[],
  atividades: AtividadeCandidata[],
): ResultadoRecomendacao {
  const janela = calcularJanela(agoraMin, compromissosDoDia);
  if (!janela) return { janela: null, recomendacoes: [], descartadas: [] };

  // Origem: posição do celular > local do compromisso anterior > local do próximo
  const destino = janela.proximo.local;
  const origem = posicaoAtual ?? janela.anterior?.local ?? destino;

  const recomendacoes: Recomendacao[] = [];
  const descartadas: Descartada[] = [];

  for (const atividade of atividades) {
    // Sem origem/destino conhecidos, o deslocamento é tratado como zero
    const idaMin = origem ? minutosDeCaminhada(origem, atividade.local) : 0;
    const voltaMin = destino ? minutosDeCaminhada(atividade.local, destino) : 0;
    const totalMin = idaMin + atividade.duracaoMin + voltaMin + MARGEM_SEGURANCA_MIN;

    // PASSO 2: filtro de viabilidade
    if (totalMin > janela.minutos) {
      descartadas.push({
        atividade,
        motivo: `Não cabe no intervalo: precisa de ${totalMin} min, há ${janela.minutos} min`,
      });
      continue;
    }

    const chegadaMin = janela.inicioMin + idaMin;
    const terminoMin = chegadaMin + atividade.duracaoMin;
    const abertoNaChegada = atividade.abreMin === null || chegadaMin >= atividade.abreMin;
    const abertoAteOFim = atividade.fechaMin === null || terminoMin <= atividade.fechaMin;

    if (!abertoNaChegada || !abertoAteOFim) {
      descartadas.push({ atividade, motivo: "Local fechado durante o horário da atividade" });
      continue;
    }

    // PASSO 3: pontuação (0 a 100)
    const aproveitamento = atividade.duracaoMin / janela.minutos;
    const proximidade = 1 - (idaMin + voltaMin) / janela.minutos;
    const pontuacao = Math.round(
      100 * (PESO_APROVEITAMENTO * aproveitamento + PESO_PROXIMIDADE * proximidade),
    );
    const folgaMin = janela.minutos - totalMin;

    recomendacoes.push({
      atividade,
      idaMin,
      voltaMin,
      totalMin,
      folgaMin,
      pontuacao,
      justificativa:
        `${atividade.duracaoMin} min de atividade, ${idaMin} min até ${atividade.localNome}, ` +
        `${voltaMin} min até "${janela.proximo.titulo}"; sobram ${folgaMin} min`,
    });
  }

  // PASSO 4: ordena da maior para a menor pontuação
  recomendacoes.sort((a, b) => b.pontuacao - a.pontuacao);

  return { janela, recomendacoes, descartadas };
}