import { distanciaMetros, type Ponto } from "../lib/geo";

// Parâmetros do algoritmo (valores definidos pela equipe e declarados na monografia)
export const JANELA_SEGUNDOS = 60; // só considera leituras dos últimos 60 s
export const PRECISAO_MAXIMA_M = 100; // descarta leituras com precisão pior que 100 m
export const PRECISAO_PADRAO_M = 50; // usada quando o celular não informa a precisão
export const LIMITE_OUTLIER_M = 150; // distância máxima até a mediana do grupo

export interface LeituraParaEstimativa {
  dispositivoId: number; // um dispositivo = um usuário em viagem
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  registradaEmMs: number;
}

export type MotivoDescarte = "PRECISAO_RUIM" | "OUTLIER" | "DIVERGENCIA";

export interface Estimativa {
  latitude: number;
  longitude: number;
  precisaoEstimadaM: number; // incerteza combinada (1 desvio-padrão aproximado)
  dispositivosUsados: number;
  dispositivosDescartados: { motivo: MotivoDescarte; quantidade: number }[];
  leituraMaisRecenteMs: number;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

function precisaoDe(l: LeituraParaEstimativa): number {
  // Evita divisão por zero se algum aparelho informar precisão 0
  return Math.max(l.precisaoMetros ?? PRECISAO_PADRAO_M, 1);
}

export function estimarPosicao(leituras: LeituraParaEstimativa[], agoraMs: number): Estimativa | null {
  // PASSO 1: só leituras recentes
  const recentes = leituras.filter(
    (l) => l.registradaEmMs >= agoraMs - JANELA_SEGUNDOS * 1000 && l.registradaEmMs <= agoraMs + 60_000,
  );

  // PASSO 2: a leitura mais recente de cada dispositivo (cada celular conta uma vez)
  const porDispositivo = new Map<number, LeituraParaEstimativa>();
  for (const l of recentes) {
    const atual = porDispositivo.get(l.dispositivoId);
    if (!atual || l.registradaEmMs > atual.registradaEmMs) porDispositivo.set(l.dispositivoId, l);
  }

  const descartes: Record<MotivoDescarte, number> = { PRECISAO_RUIM: 0, OUTLIER: 0, DIVERGENCIA: 0 };

  // PASSO 3: descarta leituras com precisão ruim
  let candidatas = [...porDispositivo.values()].filter((l) => {
    const ok = precisaoDe(l) <= PRECISAO_MAXIMA_M;
    if (!ok) descartes.PRECISAO_RUIM++;
    return ok;
  });

  if (candidatas.length === 0) return null;

  // PASSO 4: tratamento de outliers
  if (candidatas.length >= 3) {
    // Com 3 ou mais, a mediana representa a "maioria"; quem estiver longe dela é outlier
    const centro: Ponto = {
      latitude: mediana(candidatas.map((l) => l.latitude)),
      longitude: mediana(candidatas.map((l) => l.longitude)),
    };
    candidatas = candidatas.filter((l) => {
      const ok = distanciaMetros(centro, l) <= LIMITE_OUTLIER_M;
      if (!ok) descartes.OUTLIER++;
      return ok;
    });
  } else if (candidatas.length === 2 && distanciaMetros(candidatas[0], candidatas[1]) > LIMITE_OUTLIER_M) {
    // Com 2 divergentes não há maioria: fica com a de melhor precisão
    candidatas.sort((a, b) => precisaoDe(a) - precisaoDe(b));
    candidatas = [candidatas[0]];
    descartes.DIVERGENCIA++;
  }

  // Segurança: se a mediana caiu longe de todos (grupos espalhados), usa a leitura mais precisa
  if (candidatas.length === 0) {
    const melhor = [...porDispositivo.values()]
      .filter((l) => precisaoDe(l) <= PRECISAO_MAXIMA_M)
      .sort((a, b) => precisaoDe(a) - precisaoDe(b))[0];
    candidatas = [melhor];
  }

  // PASSO 5: média ponderada pelo inverso da variância (peso = 1 / precisão²)
  let somaPesos = 0;
  let somaLat = 0;
  let somaLon = 0;
  for (const l of candidatas) {
    const peso = 1 / precisaoDe(l) ** 2;
    somaPesos += peso;
    somaLat += l.latitude * peso;
    somaLon += l.longitude * peso;
  }

  return {
    latitude: somaLat / somaPesos,
    longitude: somaLon / somaPesos,
    precisaoEstimadaM: Math.round((1 / Math.sqrt(somaPesos)) * 10) / 10,
    dispositivosUsados: candidatas.length,
    dispositivosDescartados: (Object.keys(descartes) as MotivoDescarte[])
      .filter((m) => descartes[m] > 0)
      .map((motivo) => ({ motivo, quantidade: descartes[motivo] })),
    leituraMaisRecenteMs: Math.max(...candidatas.map((l) => l.registradaEmMs)),
  };
}