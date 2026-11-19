import test from "node:test";
import assert from "node:assert/strict";
import { LimitadorTentativas } from "./limite-tentativas";
test("bloqueia excesso e libera depois da janela", () => {
  let agora = 1000;
  const l = new LimitadorTentativas(2, 5000, () => agora);
  assert.equal(l.permitir("a"), true);
  assert.equal(l.permitir("a"), true);
  assert.equal(l.permitir("a"), false);
  assert.equal(l.permitir("b"), true);
  agora = 6000;
  assert.equal(l.permitir("a"), true);
});
