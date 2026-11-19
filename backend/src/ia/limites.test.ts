import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LimitadorIA, LIMITES_IA } from "./limites";

const pastas: string[] = [];
afterEach(() => { for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true }); });

function montar() {
  const pasta = mkdtempSync(join(tmpdir(), "busai-limites-"));
  pastas.push(pasta);
  let agora = Date.parse("2026-11-18T12:00:00.000Z");
  const caminho = join(pasta, "limites.json");
  return {
    caminho,
    servidor: new LimitadorIA(caminho, () => agora),
    mover: (milissegundos: number) => { agora += milissegundos; },
  };
}

test("no máximo três perguntas em 15 minutos, com renovação da janela", () => {
  const x = montar();
  for (let i = 0; i < LIMITES_IA.porUsuario15Min; i++) {
    const r = x.servidor.reservar(1);
    assert.equal(r.permitido, true);
    if (r.permitido) r.liberar();
  }
  assert.equal(x.servidor.reservar(1).permitido, false);
  x.mover(15 * 60_000 + 1);
  const nova = x.servidor.reservar(1);
  assert.equal(nova.permitido, true);
  if (nova.permitido) nova.liberar();
});

test("cota por usuário bloqueia após 6 consultas no dia", () => {
  const x = montar();
  for (let i = 0; i < LIMITES_IA.porUsuarioDia; i++) {
    const r = x.servidor.reservar(1);
    assert.equal(r.permitido, true);
    if (r.permitido) r.liberar();
    x.mover(16 * 60_000);
  }
  assert.equal(x.servidor.reservar(1).permitido, false);
  const outro = x.servidor.reservar(2);
  assert.equal(outro.permitido, true);
  if (outro.permitido) outro.liberar();
});

test("cota global bloqueia mesmo distribuindo chamadas entre vários usuários", () => {
  const x = montar();
  for (let i = 0; i < LIMITES_IA.totalDia; i++) {
    const r = x.servidor.reservar(i + 1);
    assert.equal(r.permitido, true);
    if (r.permitido) r.liberar();
  }
  assert.equal(x.servidor.reservar(1234).permitido, false);
});

test("reserva persiste após reiniciar o processo", () => {
  const x = montar();
  const r = x.servidor.reservar(1);
  assert.equal(r.permitido, true);
  if (r.permitido) r.liberar();
  const novoServidor = new LimitadorIA(x.caminho, () => Date.parse("2026-11-18T12:00:01Z"));
  for (let i = 1; i < LIMITES_IA.porUsuario15Min; i++) {
    const a = novoServidor.reservar(1);
    assert.equal(a.permitido, true);
    if (a.permitido) a.liberar();
  }
  assert.equal(novoServidor.reservar(1).permitido, false);
});

test("bloqueia mais de duas chamadas simultâneas e liberar é idempotente", () => {
  const x = montar();
  const a = x.servidor.reservar(1);
  const b = x.servidor.reservar(2);
  assert.equal(a.permitido, true);
  assert.equal(b.permitido, true);
  assert.equal(x.servidor.reservar(3).permitido, false);
  if (a.permitido) { a.liberar(); a.liberar(); }
  const c = x.servidor.reservar(3);
  assert.equal(c.permitido, true);
  if (b.permitido) b.liberar();
  if (c.permitido) c.liberar();
});

test("cota diária reinicia no dia UTC seguinte", () => {
  const x = montar();
  for (let i = 0; i < LIMITES_IA.porUsuario15Min; i++) {
    const r = x.servidor.reservar(1);
    if (r.permitido) r.liberar();
  }
  x.mover(24 * 60 * 60_000);
  const r = x.servidor.reservar(1);
  assert.equal(r.permitido, true);
  if (r.permitido) r.liberar();
});
