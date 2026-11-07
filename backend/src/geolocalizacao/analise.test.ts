import { test } from "node:test";
import assert from "node:assert/strict";
import { deslocarMetros } from "../lib/geo";
import {
  combinacoes,
  disponibilidade,
  dividirLinhaCsv,
  errosNosPontos,
  estimarNoInstante,
  instanteDeBrasilia,
  instanteDoBanco,
  intervalosEntreLeituras,
  lacunas,
  lerLeituras,
  resumo,
  type LeituraCampo,
} from "./analise";

const REAL = { latitude: -20.7334, longitude: -46.6262 };
const T0 = Date.UTC(2026, 10, 4, 10, 0, 0); // 04/11/2026 10:00:00 UTC = 07:00:00 em Brasília

function leitura(dispositivo: string, norteM: number, segundos: number, extra: Partial<LeituraCampo> = {}): LeituraCampo {
  const p = deslocarMetros(REAL, norteM, 0);
  return {
    dispositivo,
    latitude: p.latitude,
    longitude: p.longitude,
    precisaoMetros: 10,
    registradaEmMs: T0 + segundos * 1000,
    recebidaEmMs: T0 + segundos * 1000 + 500,
    ...extra,
  };
}

test("combinações de 3 aparelhos: 3 sozinhos, 3 pares e 1 trio", () => {
  const abc = ["A", "B", "C"];
  assert.deepEqual(combinacoes(abc, 1), [["A"], ["B"], ["C"]]);
  assert.deepEqual(combinacoes(abc, 2), [["A", "B"], ["A", "C"], ["B", "C"]]);
  assert.deepEqual(combinacoes(abc, 3), [["A", "B", "C"]]);
});

test("horário do banco sem fuso é tratado como UTC; o do observador, como Brasília", () => {
  assert.equal(instanteDoBanco("2026-11-04 10:00:00"), T0);
  assert.equal(instanteDoBanco("2026-11-04 10:00:00.500"), T0 + 500);
  assert.equal(instanteDeBrasilia("2026-11-04 07:00:00"), T0);
});

test("CSV: campos entre aspas e precisão vazia", () => {
  assert.deepEqual(dividirLinhaCsv('1,"a,b",,x'), ["1", "a,b", "", "x"]);
  const texto =
    "id,email,viagemId,latitude,longitude,precisaoMetros,registradaEm,recebidaEm\n" +
    "1,campo1@teste.com,9,-20.7,-46.6,,2026-11-04 10:00:00,2026-11-04 10:00:01\n";
  const [l] = lerLeituras(texto);
  assert.equal(l.dispositivo, "campo1@teste.com");
  assert.equal(l.precisaoMetros, null);
  assert.equal(l.recebidaEmMs - l.registradaEmMs, 1000);
});

test("só usa leituras que já tinham chegado ao servidor no instante", () => {
  // Medida às 10:00:00, mas presa na fila do celular (sem sinal) até 10:00:30
  const presa = leitura("A", 0, 0, { recebidaEmMs: T0 + 30_000 });
  assert.equal(estimarNoInstante([presa], ["A"], T0 + 10_000), null);
  assert.notEqual(estimarNoInstante([presa], ["A"], T0 + 31_000), null);
});

test("erro no ponto de controle e efeito de combinar aparelhos", () => {
  // A erra 20 m para o norte, B erra 20 m para o sul: juntos, se compensam
  const leituras = [leitura("A", 20, 0), leitura("B", -20, 0)];
  const pontos = [{ nome: "P1", posicao: REAL, instanteMs: T0 + 2_000 }];
  const erros = errosNosPontos(leituras, ["A", "B"], pontos);

  const sozinhoA = erros.find((e) => e.dispositivos === 1 && e.combinacao[0] === "A")!;
  const par = erros.find((e) => e.dispositivos === 2)!;
  assert.ok(Math.abs(sozinhoA.erroM! - 20) < 0.5);
  assert.ok(par.erroM! < 0.5);
  assert.equal(par.dispositivosUsados, 2);
  assert.ok(Math.abs(par.idadeS! - 2) < 0.01);
});

test("sem leitura recente não há posição: conta como indisponível", () => {
  const leituras = [leitura("A", 0, 0)];
  // De 10:00:00 a 10:02:00 a cada 5 s = 25 instantes; a leitura vale por 60 s (até 10:01:00)
  const r = disponibilidade(leituras, ["A"], T0, T0 + 120_000, 5);
  assert.equal(r.instantes, 25);
  assert.equal(r.comPosicao, 12); // de 10:00:05 a 10:01:00 (a de 10:00:00 ainda não tinha chegado)
});

test("lacunas: detecta quando o aparelho parou de medir", () => {
  // Leituras a cada 5 s, depois 10 minutos sem nada (app em segundo plano), depois volta
  const leituras = [leitura("A", 0, 0), leitura("A", 0, 5), leitura("A", 0, 10), leitura("A", 0, 610), leitura("A", 0, 615)];
  const encontradas = lacunas(leituras, "A", 60);
  assert.equal(encontradas.length, 1);
  assert.equal(encontradas[0].duracaoS, 600);
  assert.equal(encontradas[0].inicioMs, T0 + 10_000);
  assert.deepEqual(intervalosEntreLeituras(leituras, "A"), [5, 5, 600, 5]);
});

test("resumo estatístico", () => {
  const r = resumo([10, 2, 4, 8, 6])!;
  assert.equal(r.n, 5);
  assert.equal(r.media, 6);
  assert.equal(r.mediana, 6);
  assert.equal(r.maximo, 10);
  assert.equal(resumo([]), null);
});
