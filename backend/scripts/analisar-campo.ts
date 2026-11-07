// ANÁLISE dos testes de campo da geolocalização colaborativa (dados REAIS).
// Lê as leituras exportadas do banco e os pontos de controle anotados pelo observador,
// recalcula a posição com o mesmo algoritmo do sistema para cada combinação de aparelhos
// (1, 2 e 3) e calcula as métricas da seção 7 de docs/protocolo-teste-campo.md.
//
// Uso (na pasta backend):
//   npx tsx scripts/analisar-campo.ts --leituras=scripts/resultados/campo-2026-11-04.csv --pontos=scripts/campo/pontos-2026-11-04.csv
//
// Parâmetros:
//   --leituras=...   CSV exportado do banco (seção 6 do protocolo)            (obrigatório)
//   --pontos=...     CSV dos pontos de controle: ponto,latitude,longitude,data_hora
//                    data_hora no horário de Brasília: 2026-11-04 07:12:35  (opcional)
//   --passo=5        segundos entre os instantes usados na disponibilidade

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  combinacoes,
  disponibilidade,
  errosNosPontos,
  intervalosEntreLeituras,
  lacunas,
  lerLeituras,
  lerPontos,
  resumo,
  type LeituraCampo,
} from "../src/geolocalizacao/analise";
import { PRECISAO_MAXIMA_M } from "../src/geolocalizacao/estimativa";

function argumento(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1];
}

const arquivoLeituras = argumento("leituras");
const arquivoPontos = argumento("pontos");
const PASSO_S = Number(argumento("passo") ?? "5");

if (!arquivoLeituras) {
  console.error("Informe o arquivo de leituras: --leituras=scripts/resultados/campo-AAAA-MM-DD.csv");
  process.exit(1);
}

const leituras = lerLeituras(readFileSync(arquivoLeituras, "utf8"));
if (leituras.length === 0) {
  console.error("O arquivo de leituras está vazio.");
  process.exit(1);
}

// Aparelhos identificados por letras (A, B, C...) para não expor e-mails nas tabelas da monografia
const aparelhos = [...new Set(leituras.map((l) => l.dispositivo))].sort();
const letra = new Map(aparelhos.map((a, i) => [a, String.fromCharCode(65 + i)]));
const rotulo = (combinacao: string[]) => combinacao.map((a) => letra.get(a)).join("+");

// Tudo o que aparece no terminal também é guardado e gravado no arquivo de resumo
const relatorio: string[] = [];
function escrever(texto = "") {
  console.log(texto);
  relatorio.push(texto);
}

const f1 = (v: number) => v.toFixed(1).replace(".", ",");
const hora = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });

escrever("\nANÁLISE DO TESTE DE CAMPO (dados reais)");
escrever(`Arquivo: ${arquivoLeituras}`);
escrever(`Leituras: ${leituras.length} · aparelhos: ${aparelhos.length}`);
for (const a of aparelhos) escrever(`  ${letra.get(a)} = ${a}`);

const inicioMs = Math.min(...leituras.map((l) => l.registradaEmMs));
const fimMs = Math.max(...leituras.map((l) => l.registradaEmMs));
escrever(`Período: ${hora(inicioMs)} a ${hora(fimMs)} (${f1((fimMs - inicioMs) / 60000)} min)`);

// ───────────── Por aparelho: precisão e atraso de rede ─────────────

escrever("\n1. POR APARELHO");
escrever("Aparelho | Leituras | Precisão mediana (m) | Precisão p90 (m) | > 100 m | Atraso mediano (s) | Atraso p90 (s) | Atraso máx (s)");
const linhasAparelhos = ["aparelho,leituras,precisao_mediana_m,precisao_p90_m,pct_acima_limite,atraso_mediano_s,atraso_p90_s,atraso_max_s"];
for (const a of aparelhos) {
  const doAparelho = leituras.filter((l) => l.dispositivo === a);
  const precisoes = doAparelho.map((l) => l.precisaoMetros).filter((p): p is number => p !== null);
  const atrasos = doAparelho.map((l) => (l.recebidaEmMs - l.registradaEmMs) / 1000);
  const p = resumo(precisoes);
  const at = resumo(atrasos)!;
  const acima = precisoes.length ? (100 * precisoes.filter((v) => v > PRECISAO_MAXIMA_M).length) / precisoes.length : 0;
  escrever(
    `${letra.get(a)} | ${doAparelho.length} | ${p ? f1(p.mediana) : "—"} | ${p ? f1(p.p90) : "—"} | ${f1(acima)}% | ${f1(at.mediana)} | ${f1(at.p90)} | ${f1(at.maximo)}`,
  );
  linhasAparelhos.push(
    [letra.get(a), doAparelho.length, p?.mediana ?? "", p?.p90 ?? "", acima.toFixed(1), at.mediana, at.p90, at.maximo].join(","),
  );
}

// ───────────── Coleta: o aparelho mediu sem parar? ─────────────

const LIMITE_LACUNA_S = 60;
escrever(`\n1.1 COLETA (lacuna = mais de ${LIMITE_LACUNA_S} s sem nenhuma leitura)`);
escrever("Aparelho | Esperadas (1 a cada 5 s) | Recebidas | Intervalo mediano (s) | Lacunas | Tempo em lacunas | Maior lacuna");
for (const a of aparelhos) {
  const doAparelho = leituras.filter((l) => l.dispositivo === a);
  const inicio = Math.min(...doAparelho.map((l) => l.registradaEmMs));
  const fim = Math.max(...doAparelho.map((l) => l.registradaEmMs));
  const esperadas = Math.floor((fim - inicio) / 5000) + 1;
  const intervalos = resumo(intervalosEntreLeituras(leituras, a));
  const encontradas = lacunas(leituras, a, LIMITE_LACUNA_S);
  const tempoLacunas = encontradas.reduce((s, l) => s + l.duracaoS, 0);
  const maior = encontradas.reduce((m, l) => Math.max(m, l.duracaoS), 0);
  escrever(
    `${letra.get(a)} | ${esperadas} | ${doAparelho.length} (${f1((100 * doAparelho.length) / esperadas)}%) | ${
      intervalos ? f1(intervalos.mediana) : "—"
    } | ${encontradas.length} | ${f1(tempoLacunas / 60)} min (${f1((100 * tempoLacunas * 1000) / Math.max(fim - inicio, 1))}%) | ${
      maior ? `${f1(maior / 60)} min` : "—"
    }`,
  );
  // As maiores lacunas, com horário, para cruzar com as anotações da viagem
  for (const l of [...encontradas].sort((x, y) => y.duracaoS - x.duracaoS).slice(0, 5)) {
    escrever(`    ${letra.get(a)}: sem leituras de ${hora(l.inicioMs)} a ${hora(l.fimMs)} (${f1(l.duracaoS / 60)} min)`);
  }
}

// ───────────── Disponibilidade por cenário ─────────────

escrever(`\n2. DISPONIBILIDADE (instantes a cada ${PASSO_S} s com posição estimada)`);
escrever("Combinação | Instantes | Com posição | Disponibilidade | Descartes");
const linhasDisp = ["dispositivos,combinacao,instantes,com_posicao,disponibilidade_pct,descartes"];
const dispPorCenario = new Map<number, number[]>();
for (let k = 1; k <= aparelhos.length; k++) {
  for (const combinacao of combinacoes(aparelhos, k)) {
    const d = disponibilidade(leituras, combinacao, inicioMs, fimMs, PASSO_S);
    const pct = (100 * d.comPosicao) / d.instantes;
    dispPorCenario.set(k, [...(dispPorCenario.get(k) ?? []), pct]);
    const descartes = Object.entries(d.descartes).map(([m, q]) => `${m}:${q}`).join(" ");
    escrever(`${rotulo(combinacao)} | ${d.instantes} | ${d.comPosicao} | ${f1(pct)}% | ${descartes || "—"}`);
    linhasDisp.push([k, rotulo(combinacao), d.instantes, d.comPosicao, pct.toFixed(1), `"${descartes}"`].join(","));
  }
}

// ───────────── Erro nos pontos de controle ─────────────

const base = basename(arquivoLeituras, ".csv");
mkdirSync("scripts/resultados", { recursive: true });
writeFileSync(`scripts/resultados/analise-${base}-aparelhos.csv`, linhasAparelhos.join("\n"), "utf8");
writeFileSync(`scripts/resultados/analise-${base}-disponibilidade.csv`, linhasDisp.join("\n"), "utf8");

if (!arquivoPontos) {
  escrever("\n(Sem --pontos: erro nos pontos de controle não calculado.)");
} else {
  const pontos = lerPontos(readFileSync(arquivoPontos, "utf8"));
  const erros = errosNosPontos(leituras as LeituraCampo[], aparelhos, pontos);

  escrever(`\n3. ERRO NOS PONTOS DE CONTROLE (${pontos.length} pontos)`);
  escrever("Ponto | Horário | Combinação | Erro (m) | Precisão estimada (m) | Idade da leitura (s) | Descartes");
  const linhasErros = ["ponto,horario,dispositivos,combinacao,erro_m,precisao_estimada_m,dispositivos_usados,idade_s,descartes"];
  for (const e of erros) {
    const ponto = pontos.find((p) => p.nome === e.ponto)!;
    escrever(
      `${e.ponto} | ${hora(ponto.instanteMs)} | ${rotulo(e.combinacao)} | ${e.erroM === null ? "sem posição" : f1(e.erroM)} | ${
        e.precisaoEstimadaM ?? "—"
      } | ${e.idadeS === null ? "—" : f1(e.idadeS)} | ${e.descartes || "—"}`,
    );
    linhasErros.push(
      [
        `"${e.ponto}"`,
        hora(ponto.instanteMs),
        e.dispositivos,
        rotulo(e.combinacao),
        e.erroM?.toFixed(1) ?? "",
        e.precisaoEstimadaM ?? "",
        e.dispositivosUsados,
        e.idadeS?.toFixed(1) ?? "",
        `"${e.descartes}"`,
      ].join(","),
    );
  }
  writeFileSync(`scripts/resultados/analise-${base}-erros.csv`, linhasErros.join("\n"), "utf8");

  // ───────────── Resumo por cenário ─────────────

  escrever("\n4. RESUMO POR CENÁRIO");
  escrever("Dispositivos | Medições | Sem posição | Erro médio (m) | Mediana (m) | p90 (m) | Máximo (m) | Disponibilidade média");
  for (let k = 1; k <= aparelhos.length; k++) {
    const doCenario = erros.filter((e) => e.dispositivos === k);
    const valores = doCenario.map((e) => e.erroM).filter((v): v is number => v !== null);
    const r = resumo(valores);
    const disp = dispPorCenario.get(k)!;
    const dispMedia = disp.reduce((s, v) => s + v, 0) / disp.length;
    escrever(
      `${k} | ${doCenario.length} | ${doCenario.length - valores.length} | ${r ? f1(r.media) : "—"} | ${r ? f1(r.mediana) : "—"} | ${
        r ? f1(r.p90) : "—"
      } | ${r ? f1(r.maximo) : "—"} | ${f1(dispMedia)}%`,
    );
  }
}

escrever("\nLembrete: amostra pequena; apresentar os valores observados sem generalizar (seção 8 do protocolo).");

// Resumo enxuto: o mesmo texto do terminal, num arquivo para guardar junto com as planilhas
const arquivoResumo = `scripts/resultados/analise-${base}-resumo.txt`;
writeFileSync(arquivoResumo, relatorio.join("\n") + "\n", "utf8");
console.log(`\nResumo gravado em ${arquivoResumo}`);
console.log(`Tabelas detalhadas em scripts/resultados/analise-${base}-*.csv\n`);
