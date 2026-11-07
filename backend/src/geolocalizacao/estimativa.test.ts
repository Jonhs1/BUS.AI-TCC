import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimarPosicao, type LeituraParaEstimativa } from "./estimativa";
import { deslocarMetros, distanciaMetros } from "../lib/geo";

// Ponto de referência: ponto de embarque informado pela equipe
const REF = { latitude: -20.733398829934966, longitude: -46.62616344943692 };
const AGORA = Date.UTC(2026, 10, 3, 22, 0, 0);

// Cria uma leitura a alguns metros da referência, alguns segundos atrás
function leitura(
  dispositivoId: number,
  norteM: number,
  lesteM: number,
  precisaoMetros: number | null,
  segundosAtras = 5,
): LeituraParaEstimativa {
  const p = deslocarMetros(REF, norteM, lesteM);
  return { dispositivoId, ...p, precisaoMetros, registradaEmMs: AGORA - segundosAtras * 1000 };
}

function erroAteReferencia(e: { latitude: number; longitude: number }) {
  return distanciaMetros(REF, e);
}

describe("Estimativa de posição colaborativa", () => {
  it("sem leituras recentes → sem estimativa", () => {
    assert.equal(estimarPosicao([], AGORA), null);
    assert.equal(estimarPosicao([leitura(1, 0, 0, 10, 120)], AGORA), null); // 2 min atrás
  });

  it("1 dispositivo → a posição é a própria leitura", () => {
    const e = estimarPosicao([leitura(1, 20, 0, 10)], AGORA)!;
    assert.ok(Math.abs(erroAteReferencia(e) - 20) < 0.5);
    assert.equal(e.dispositivosUsados, 1);
    assert.equal(e.precisaoEstimadaM, 10);
  });

  it("2 dispositivos com a mesma precisão → ponto médio", () => {
    const e = estimarPosicao([leitura(1, 20, 0, 10), leitura(2, -20, 0, 10)], AGORA)!;
    assert.ok(erroAteReferencia(e) < 0.5, `erro: ${erroAteReferencia(e).toFixed(2)} m`);
  });

  it("leitura mais precisa pesa mais (5 m vs 20 m → peso 16 vs 1)", () => {
    const e = estimarPosicao([leitura(1, 0, 0, 5), leitura(2, 34, 0, 20)], AGORA)!;
    // média ponderada: 34 × 1/17 = 2 m ao norte da referência
    assert.ok(Math.abs(erroAteReferencia(e) - 2) < 0.5, `erro: ${erroAteReferencia(e).toFixed(2)} m`);
  });

  it("cada celular conta uma vez, com a leitura mais recente", () => {
    const e = estimarPosicao([leitura(1, 50, 0, 10, 30), leitura(1, 0, 0, 10, 2)], AGORA)!;
    assert.equal(e.dispositivosUsados, 1);
    assert.ok(erroAteReferencia(e) < 0.5);
  });

  it("descarta leitura com precisão pior que 100 m", () => {
    const e = estimarPosicao([leitura(1, 0, 0, 10), leitura(2, 80, 0, 300)], AGORA)!;
    assert.equal(e.dispositivosUsados, 1);
    assert.deepEqual(e.dispositivosDescartados, [{ motivo: "PRECISAO_RUIM", quantidade: 1 }]);
  });

  it("3 dispositivos, 1 a 500 m dos outros → outlier descartado", () => {
    const e = estimarPosicao([leitura(1, 5, 0, 10), leitura(2, -5, 0, 10), leitura(3, 500, 0, 10)], AGORA)!;
    assert.equal(e.dispositivosUsados, 2);
    assert.deepEqual(e.dispositivosDescartados, [{ motivo: "OUTLIER", quantidade: 1 }]);
    assert.ok(erroAteReferencia(e) < 1);
  });

  it("2 dispositivos divergentes → fica com o mais preciso", () => {
    const e = estimarPosicao([leitura(1, 0, 0, 8), leitura(2, 400, 0, 25)], AGORA)!;
    assert.equal(e.dispositivosUsados, 1);
    assert.ok(erroAteReferencia(e) < 0.5);
    assert.deepEqual(e.dispositivosDescartados, [{ motivo: "DIVERGENCIA", quantidade: 1 }]);
  });

  it("mais dispositivos concordando → incerteza combinada menor", () => {
    const um = estimarPosicao([leitura(1, 0, 0, 10)], AGORA)!;
    const tres = estimarPosicao([leitura(1, 0, 0, 10), leitura(2, 3, 0, 10), leitura(3, -3, 0, 10)], AGORA)!;
    assert.ok(tres.precisaoEstimadaM < um.precisaoEstimadaM);
    assert.equal(tres.precisaoEstimadaM, 5.8); // 10 / √3
  });
});