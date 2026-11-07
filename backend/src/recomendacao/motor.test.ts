import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcularJanela, recomendar, type AtividadeCandidata, type CompromissoDoDia } from "./motor";
import { distanciaMetros, minutosDeCaminhada } from "../lib/geo";

// Coordenadas reais informadas pela equipe (Google Maps)
const UNIDADE_5 = { latitude: -20.734877429956306, longitude: -46.62568049632971 };
const BIBLIOTECA = { latitude: -20.73525500686421, longitude: -46.625466227646854 };
const LANCHONETE = { latitude: -20.733746237624924, longitude: -46.62537052215952 };
const SECRETARIA = { latitude: -20.73374934823229, longitude: -46.60491171583834 };

function aula(titulo: string, inicioMin: number, fimMin: number): CompromissoDoDia {
  return { titulo, inicioMin, fimMin, local: UNIDADE_5 };
}

function atividade(
  id: number,
  titulo: string,
  duracaoMin: number,
  localNome: string,
  local: { latitude: number; longitude: number },
  abreMin: number | null = null,
  fechaMin: number | null = null,
): AtividadeCandidata {
  return { id, titulo, categoria: "OUTRO", duracaoMin, abreMin, fechaMin, localNome, local };
}

const ESTUDAR = atividade(1, "Estudar na biblioteca", 45, "Biblioteca", BIBLIOTECA);
const LANCHE = atividade(2, "Fazer um lanche", 20, "Lanchonete", LANCHONETE);
const SECRETARIA_ATV = atividade(3, "Resolver pendências", 20, "Secretaria Geral", SECRETARIA);

describe("Cálculo de distância e deslocamento", () => {
  it("Unidade 5 → Biblioteca fica a menos de 100 m", () => {
    const metros = distanciaMetros(UNIDADE_5, BIBLIOTECA);
    assert.ok(metros > 20 && metros < 100, `distância calculada: ${metros.toFixed(0)} m`);
  });

  it("Unidade 5 → Secretaria Geral fica a mais de 1,5 km", () => {
    assert.ok(distanciaMetros(UNIDADE_5, SECRETARIA) > 1500);
  });

  it("caminhada até a Secretaria leva mais de 25 minutos", () => {
    assert.ok(minutosDeCaminhada(UNIDADE_5, SECRETARIA) > 25);
  });
});

describe("Janela de tempo livre", () => {
  it("aula termina 14:00 e a próxima começa 15:30 → 90 minutos", () => {
    const janela = calcularJanela(840, [aula("A", 780, 840), aula("B", 930, 1030)]);
    assert.equal(janela?.minutos, 90);
    assert.equal(janela?.proximo.titulo, "B");
  });

  it("durante uma aula, a janela começa quando ela termina", () => {
    // agora 19:30, aula 19:00–20:40, próxima 21:00 → janela de 20 min
    const janela = calcularJanela(1170, [aula("A", 1140, 1240), aula("B", 1260, 1360)]);
    assert.equal(janela?.inicioMin, 1240);
    assert.equal(janela?.minutos, 20);
  });

  it("sem próximo compromisso no dia → sem janela", () => {
    assert.equal(calcularJanela(1400, [aula("A", 1140, 1240)]), null);
  });
});

describe("Recomendação", () => {
  const agenda = [aula("Aula anterior", 780, 840), aula("Próxima aula", 930, 1030)]; // livre 14:00–15:30

  it("intervalo de 90 min com biblioteca ao lado → recomenda estudar", () => {
    const r = recomendar(840, null, agenda, [ESTUDAR]);
    assert.equal(r.recomendacoes.length, 1);
    assert.equal(r.recomendacoes[0].atividade.titulo, "Estudar na biblioteca");
  });

  it("intervalo de 20 min → NÃO recomenda atividade de 45 min", () => {
    const curta = [aula("A", 1140, 1240), aula("B", 1260, 1360)]; // livre 20:40–21:00
    const r = recomendar(1240, null, curta, [ESTUDAR]);
    assert.equal(r.recomendacoes.length, 0);
    assert.match(r.descartadas[0].motivo, /Não cabe/);
  });

  it("biblioteca fecha antes de a atividade terminar → NÃO recomenda", () => {
    const fechaCedo = atividade(1, "Estudar na biblioteca", 45, "Biblioteca", BIBLIOTECA, 480, 870); // fecha 14:30
    const r = recomendar(840, null, agenda, [fechaCedo]);
    assert.equal(r.recomendacoes.length, 0);
    assert.match(r.descartadas[0].motivo, /fechado/);
  });

  it("atividade curta, mas local longe demais para voltar a tempo → NÃO recomenda", () => {
    const umaHora = [aula("A", 780, 840), aula("B", 900, 1000)]; // livre 14:00–15:00
    const r = recomendar(840, null, umaHora, [SECRETARIA_ATV]);
    assert.equal(r.recomendacoes.length, 0);
    assert.match(r.descartadas[0].motivo, /Não cabe/);
  });

  it("ordena pela pontuação: estudar (45 min) vem antes do lanche (20 min) em 90 min livres", () => {
    const r = recomendar(840, null, agenda, [LANCHE, ESTUDAR]);
    assert.deepEqual(
      r.recomendacoes.map((x) => x.atividade.titulo),
      ["Estudar na biblioteca", "Fazer um lanche"],
    );
  });

  it("garantia principal: nenhuma recomendação ultrapassa o tempo livre", () => {
    const todas = [ESTUDAR, LANCHE, SECRETARIA_ATV];
    for (let agora = 0; agora < 24 * 60; agora += 5) {
      const r = recomendar(agora, null, agenda, todas);
      for (const rec of r.recomendacoes) {
        assert.ok(rec.totalMin <= r.janela!.minutos, `violação às ${agora} min: ${rec.atividade.titulo}`);
      }
    }
  });
});