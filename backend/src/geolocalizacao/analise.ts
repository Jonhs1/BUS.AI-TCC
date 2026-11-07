// Análise dos testes de campo da geolocalização colaborativa.
// Recalcula a posição do ônibus com o MESMO algoritmo do sistema (estimarPosicao),
// usando subconjuntos dos celulares, para comparar os cenários de 1, 2 e 3 dispositivos
// nas mesmas condições (mesmo trajeto, horário e trânsito). Ver docs/protocolo-teste-campo.md.
import { distanciaMetros, type Ponto } from "../lib/geo";
import { estimarPosicao, type Estimativa } from "./estimativa";

// Uma linha do CSV exportado do banco (seção 6 do protocolo)
export interface LeituraCampo {
  dispositivo: string; // e-mail da conta usada no aparelho
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  registradaEmMs: number; // quando o celular mediu
  recebidaEmMs: number; // quando o servidor recebeu
}

// Um ponto de controle com o horário anotado pelo observador
export interface PontoControle {
  nome: string;
  posicao: Ponto;
  instanteMs: number;
}

// ───────────── Leitura dos arquivos ─────────────

// Divide uma linha de CSV respeitando campos entre aspas
export function dividirLinhaCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (c === "," && !entreAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((campo) => campo.trim());
}

// Transforma o texto do CSV em objetos { coluna: valor }
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length === 0) return [];
  const cabecalho = dividirLinhaCsv(linhas[0]);
  return linhas.slice(1).map((linha) => {
    const valores = dividirLinhaCsv(linha);
    return Object.fromEntries(cabecalho.map((coluna, i) => [coluna, valores[i] ?? ""]));
  });
}

// Horários exportados pelo psql vêm sem fuso ("2026-11-04 10:12:35.125").
// O Prisma grava em UTC, então um horário sem fuso é tratado como UTC.
export function instanteDoBanco(texto: string): number {
  const iso = texto.trim().replace(" ", "T");
  const temFuso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const ms = Date.parse(temFuso ? iso : `${iso}Z`);
  if (Number.isNaN(ms)) throw new Error(`Horário inválido no CSV de leituras: "${texto}"`);
  return ms;
}

// O observador anota no horário de Brasília ("2026-11-04 07:12:35"), que é UTC-3 (sem horário de verão)
export function instanteDeBrasilia(texto: string): number {
  const iso = texto.trim().replace(" ", "T");
  const ms = Date.parse(`${iso}-03:00`);
  if (Number.isNaN(ms)) throw new Error(`Horário inválido no CSV de pontos: "${texto}" (use AAAA-MM-DD HH:MM:SS)`);
  return ms;
}

function numero(texto: string, campo: string): number {
  const valor = Number(texto);
  if (texto === "" || Number.isNaN(valor)) throw new Error(`Valor inválido em "${campo}": "${texto}"`);
  return valor;
}

export function lerLeituras(texto: string): LeituraCampo[] {
  return lerCsv(texto).map((l) => ({
    dispositivo: l.email,
    latitude: numero(l.latitude, "latitude"),
    longitude: numero(l.longitude, "longitude"),
    precisaoMetros: l.precisaoMetros === "" ? null : numero(l.precisaoMetros, "precisaoMetros"),
    registradaEmMs: instanteDoBanco(l.registradaEm),
    recebidaEmMs: instanteDoBanco(l.recebidaEm),
  }));
}

export function lerPontos(texto: string): PontoControle[] {
  return lerCsv(texto).map((p) => ({
    nome: p.ponto,
    posicao: { latitude: numero(p.latitude, "latitude"), longitude: numero(p.longitude, "longitude") },
    instanteMs: instanteDeBrasilia(p.data_hora),
  }));
}

// ───────────── Cenários ─────────────

// Todas as combinações de k elementos (ex.: pares de [A, B, C] = AB, AC, BC)
export function combinacoes<T>(itens: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (itens.length < k) return [];
  const [primeiro, ...resto] = itens;
  return [...combinacoes(resto, k - 1).map((c) => [primeiro, ...c]), ...combinacoes(resto, k)];
}

// Posição que o SERVIDOR teria calculado no instante t usando só os aparelhos escolhidos.
// Só entram leituras que já tinham CHEGADO ao servidor até t (recebidaEm <= t): uma leitura
// guardada na fila do celular, sem sinal, ainda não estava disponível naquele momento.
export function estimarNoInstante(leituras: LeituraCampo[], aparelhos: string[], tMs: number): Estimativa | null {
  const ids = new Map(aparelhos.map((a, i) => [a, i]));
  const disponiveis = leituras
    .filter((l) => ids.has(l.dispositivo) && l.recebidaEmMs <= tMs)
    .map((l) => ({
      dispositivoId: ids.get(l.dispositivo)!,
      latitude: l.latitude,
      longitude: l.longitude,
      precisaoMetros: l.precisaoMetros,
      registradaEmMs: l.registradaEmMs,
    }));
  return estimarPosicao(disponiveis, tMs);
}

export interface ErroNoPonto {
  ponto: string;
  dispositivos: number;
  combinacao: string[];
  erroM: number | null; // null = sem posição estimada naquele instante
  precisaoEstimadaM: number | null;
  dispositivosUsados: number;
  idadeS: number | null; // quão antiga era a leitura mais recente usada
  descartes: string;
}

// Erro da posição estimada em cada ponto de controle, para cada combinação de aparelhos
export function errosNosPontos(leituras: LeituraCampo[], aparelhos: string[], pontos: PontoControle[]): ErroNoPonto[] {
  const resultado: ErroNoPonto[] = [];
  for (let k = 1; k <= aparelhos.length; k++) {
    for (const combinacao of combinacoes(aparelhos, k)) {
      for (const ponto of pontos) {
        const e = estimarNoInstante(leituras, combinacao, ponto.instanteMs);
        resultado.push({
          ponto: ponto.nome,
          dispositivos: k,
          combinacao,
          erroM: e ? distanciaMetros(e, ponto.posicao) : null,
          precisaoEstimadaM: e ? e.precisaoEstimadaM : null,
          dispositivosUsados: e ? e.dispositivosUsados : 0,
          idadeS: e ? (ponto.instanteMs - e.leituraMaisRecenteMs) / 1000 : null,
          descartes: e ? e.dispositivosDescartados.map((d) => `${d.motivo}:${d.quantidade}`).join(" ") : "",
        });
      }
    }
  }
  return resultado;
}

// Percentual dos instantes da viagem (a cada passoS segundos) em que havia posição estimada
export function disponibilidade(
  leituras: LeituraCampo[],
  aparelhos: string[],
  inicioMs: number,
  fimMs: number,
  passoS = 5,
): { instantes: number; comPosicao: number; descartes: Record<string, number> } {
  let instantes = 0;
  let comPosicao = 0;
  const descartes: Record<string, number> = {};
  for (let t = inicioMs; t <= fimMs; t += passoS * 1000) {
    instantes++;
    const e = estimarNoInstante(leituras, aparelhos, t);
    if (!e) continue;
    comPosicao++;
    for (const d of e.dispositivosDescartados) descartes[d.motivo] = (descartes[d.motivo] ?? 0) + d.quantidade;
  }
  return { instantes, comPosicao, descartes };
}

// ───────────── Lacunas na coleta ─────────────

export interface Lacuna {
  inicioMs: number; // horário da última leitura antes da lacuna
  fimMs: number; // horário da primeira leitura depois dela
  duracaoS: number;
}

// Períodos em que um aparelho ficou mais de limiteS segundos sem medir nenhuma posição.
// Mostra quando o app parou de coletar (tela bloqueada, app em segundo plano, GPS sem sinal).
export function lacunas(leituras: LeituraCampo[], dispositivo: string, limiteS = 60): Lacuna[] {
  const instantes = leituras
    .filter((l) => l.dispositivo === dispositivo)
    .map((l) => l.registradaEmMs)
    .sort((a, b) => a - b);
  const resultado: Lacuna[] = [];
  for (let i = 1; i < instantes.length; i++) {
    const duracaoS = (instantes[i] - instantes[i - 1]) / 1000;
    if (duracaoS > limiteS) resultado.push({ inicioMs: instantes[i - 1], fimMs: instantes[i], duracaoS });
  }
  return resultado;
}

// Intervalos (em segundos) entre leituras consecutivas de um aparelho
export function intervalosEntreLeituras(leituras: LeituraCampo[], dispositivo: string): number[] {
  const instantes = leituras
    .filter((l) => l.dispositivo === dispositivo)
    .map((l) => l.registradaEmMs)
    .sort((a, b) => a - b);
  return instantes.slice(1).map((t, i) => (t - instantes[i]) / 1000);
}

// ───────────── Estatística descritiva ─────────────

export function resumo(valores: number[]) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const percentil = (p: number) => ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)];
  return {
    n: ordenados.length,
    media: ordenados.reduce((s, v) => s + v, 0) / ordenados.length,
    mediana: percentil(50),
    p90: percentil(90),
    maximo: ordenados[ordenados.length - 1],
  };
}
