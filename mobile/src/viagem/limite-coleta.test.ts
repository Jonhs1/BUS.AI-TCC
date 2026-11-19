import test from "node:test";
import assert from "node:assert/strict";
import { coletaExpirou, DURACAO_MAXIMA_COLETA_MS } from "./limite-coleta";
test("coleta é interrompida a partir de 180 minutos", () => {
  assert.equal(coletaExpirou(1000, 1000 + DURACAO_MAXIMA_COLETA_MS - 1), false);
  assert.equal(coletaExpirou(1000, 1000 + DURACAO_MAXIMA_COLETA_MS), true);
  assert.equal(coletaExpirou(1000, 1000 + DURACAO_MAXIMA_COLETA_MS + 1000), true);
});
