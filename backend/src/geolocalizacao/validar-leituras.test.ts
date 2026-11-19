import test from "node:test";
import assert from "node:assert/strict";
import { separarLeiturasPorPeriodo, DURACAO_MAXIMA_VIAGEM_MIN } from "./validar-leituras";

test("preserva as leituras válidas mesmo se uma for anterior ao embarque", () => {
  const inicio = Date.parse("2026-11-18T12:00:00Z");
  const lote = [inicio - 200_000, inicio + 5_000, inicio + 10_000].map((ms) => ({ registradaEm: new Date(ms) }));
  const resultado = separarLeiturasPorPeriodo(lote, inicio, inicio + 12_000);
  assert.equal(resultado.validas.length, 2);
  assert.equal(resultado.descartadas, 1);
});

test("descarta relógio muito no futuro e conserva as leituras válidas", () => {
  const inicio = Date.parse("2026-11-18T12:00:00Z");
  const lote = [inicio + 10_000, inicio + 500_000].map((ms) => ({ registradaEm: new Date(ms) }));
  const resultado = separarLeiturasPorPeriodo(lote, inicio, inicio + 11_000);
  assert.deepEqual(resultado, { validas: [lote[0]], descartadas: 1 });
});

test("não aceita amostras medidas depois de três horas de viagem", () => {
  const inicio = Date.parse("2026-11-18T12:00:00Z");
  const fim = inicio + DURACAO_MAXIMA_VIAGEM_MIN * 60_000;
  const lote = [fim - 1, fim + 1].map((ms) => ({ registradaEm: new Date(ms) }));
  const resultado = separarLeiturasPorPeriodo(lote, inicio, fim - 1);
  assert.equal(resultado.validas.length, 1);
  assert.equal(resultado.descartadas, 1);
});

test("lote com todas inválidas retorna zero válidas sem falhar", () => {
  const inicio = Date.parse("2026-11-18T12:00:00Z");
  const resultado = separarLeiturasPorPeriodo([{ registradaEm: new Date(inicio - 500_000) }], inicio, inicio);
  assert.equal(resultado.validas.length, 0);
  assert.equal(resultado.descartadas, 1);
});
