// SIMULAÇÃO de celulares dentro de um ônibus, enviando posições pela API real.
// Os dados gerados são SINTÉTICOS: servem para testar o sistema de ponta a ponta,
// não substituem os testes de campo.
//
// Uso (na pasta backend):
//   npx tsx scripts/simular.ts --dispositivos=3 --intervalo=5 --rodadas=6
//
// Parâmetros (todos opcionais):
//   --url=http://localhost:3333   endereço do backend
//   --linha=1                     id da linha
//   --dispositivos=3              quantos celulares simular (1 a 10)
//   --intervalo=5                 segundos entre envios (o erro é medido logo após o envio
//                                 e logo antes do próximo, para medir o efeito do atraso)
//   --rodadas=6                   quantos envios cada celular faz
//   --ruido=10                    erro típico do GPS de cada celular, em metros
//   --velocidade=8                velocidade do ônibus em m/s (8 m/s ≈ 29 km/h; 0 = parado)
//   --outlier                     o último celular envia posições ~500 m erradas

import { mkdirSync, writeFileSync } from "node:fs";
import { deslocarMetros, distanciaMetros, type Ponto } from "../src/lib/geo";

// ───────────── Parâmetros ─────────────

function argumento(nome: string, padrao: string): string {
  const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return encontrado ? encontrado.split("=")[1] : padrao;
}

const URL_BASE = argumento("url", "http://localhost:3333");
const LINHA_ID = Number(argumento("linha", "1"));
const DISPOSITIVOS = Math.min(Math.max(Number(argumento("dispositivos", "3")), 1), 10);
const INTERVALO_S = Number(argumento("intervalo", "5"));
const RODADAS = Number(argumento("rodadas", "6"));
const RUIDO_M = Number(argumento("ruido", "10"));
const VELOCIDADE_MS = Number(argumento("velocidade", "8"));
const COM_OUTLIER = process.argv.includes("--outlier");

// Ponto de partida: ponto de embarque informado pela equipe. O ônibus "anda" para o leste.
const PARTIDA: Ponto = { latitude: -20.733398829934966, longitude: -46.62616344943692 };
const SENHA = "simulacao123";

// ───────────── Funções auxiliares ─────────────

async function api(metodo: string, caminho: string, token?: string, corpo?: unknown) {
  const resposta = await fetch(`${URL_BASE}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  try {
    return { status: resposta.status, dados: texto ? JSON.parse(texto) : null };
  } catch {
    throw new Error(
      `${metodo} ${URL_BASE}${caminho} respondeu ${resposta.status} sem JSON. ` +
        `Confira se o --url é só o endereço base (sem /health ou outro caminho no final).`,
    );
  }
}

// Número aleatório com distribuição normal (média 0, desvio 1) — método de Box-Muller
function normal(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Posição verdadeira do ônibus depois de "segundos" de viagem
function posicaoReal(segundos: number): Ponto {
  return deslocarMetros(PARTIDA, 0, VELOCIDADE_MS * segundos);
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────── Preparação: um usuário de teste por celular ─────────────

async function prepararCelular(numero: number) {
  const email = `simulador${numero}@teste.com`;
  await api("POST", "/auth/cadastro", undefined, { nome: `Simulador ${numero}`, email, senha: SENHA });

  const login = await api("POST", "/auth/login", undefined, { email, senha: SENHA });
  if (login.status !== 200) throw new Error(`Login do simulador ${numero} falhou: ${JSON.stringify(login.dados)}`);
  const token: string = login.dados.token;

  await api("POST", "/usuarios/me/consentimento-localizacao", token);
  const viagem = await api("POST", "/viagens", token, { linhaId: LINHA_ID });
  if (viagem.status !== 201) throw new Error(`Viagem do simulador ${numero} falhou: ${JSON.stringify(viagem.dados)}`);

  return { numero, token, viagemId: viagem.dados.viagem.id as number };
}

// ───────────── Execução ─────────────

async function main() {
  console.log("SIMULAÇÃO (dados sintéticos)");
  console.log(
    `dispositivos=${DISPOSITIVOS} intervalo=${INTERVALO_S}s rodadas=${RODADAS} ` +
      `ruido=${RUIDO_M}m velocidade=${VELOCIDADE_MS}m/s outlier=${COM_OUTLIER ? "sim" : "não"}\n`,
  );

  const celulares: Awaited<ReturnType<typeof prepararCelular>>[] = [];
  for (let i = 1; i <= DISPOSITIVOS; i++) celulares.push(await prepararCelular(i));

  const inicio = Date.now();
  const linhasCsv = [
    "rodada,dispositivos,intervalo_s,velocidade_ms,ruido_m,outlier,erro_logo_apos_envio_m,erro_antes_proximo_envio_m,precisao_estimada_m,dispositivos_usados,descartados",
  ];
  const errosLogo: number[] = [];
  const errosAntes: number[] = [];

  // Consulta a posição estimada e mede a distância até a posição verdadeira NESTE instante
  async function medirErro() {
    const consulta = await api("GET", `/linhas/${LINHA_ID}/posicao`, celulares[0].token);
    const real = posicaoReal((Date.now() - inicio) / 1000);
    const posicao = consulta.dados?.posicao;
    return posicao ? { erro: distanciaMetros(real, posicao), posicao } : null;
  }

  for (let rodada = 1; rodada <= RODADAS; rodada++) {
    // Cada celular mede a posição verdadeira + erro aleatório do GPS
    for (const celular of celulares) {
      const real = posicaoReal((Date.now() - inicio) / 1000);
      const ehOutlier = COM_OUTLIER && celular.numero === DISPOSITIVOS && DISPOSITIVOS > 1;
      const medida = deslocarMetros(real, RUIDO_M * normal() + (ehOutlier ? 500 : 0), RUIDO_M * normal());

      await api("POST", `/viagens/${celular.viagemId}/leituras`, celular.token, {
        leituras: [{ ...medida, precisaoMetros: RUIDO_M, registradaEm: Date.now() }],
      });
    }

    // 1ª medição: logo após o envio (posição "fresca")
    const logo = await medirErro();

    // Espera o intervalo: o ônibus continua andando, mas a posição no sistema fica parada
    await esperar(INTERVALO_S * 1000);

    // 2ª medição: logo antes do próximo envio (pior caso de atraso)
    const antes = await medirErro();

    if (logo && antes) {
      errosLogo.push(logo.erro);
      errosAntes.push(antes.erro);
      const descartados = logo.posicao.dispositivosDescartados
        .map((d: { motivo: string; quantidade: number }) => `${d.motivo}:${d.quantidade}`)
        .join(" ");
      console.log(
        `rodada ${rodada}: erro logo após envio=${logo.erro.toFixed(1)} m | ` +
          `antes do próximo envio=${antes.erro.toFixed(1)} m | usados=${logo.posicao.dispositivosUsados}` +
          (descartados ? ` | descartados ${descartados}` : ""),
      );
      linhasCsv.push(
        [rodada, DISPOSITIVOS, INTERVALO_S, VELOCIDADE_MS, RUIDO_M, COM_OUTLIER, logo.erro.toFixed(2),
          antes.erro.toFixed(2), logo.posicao.precisaoEstimadaM, logo.posicao.dispositivosUsados,
          `"${descartados}"`].join(","),
      );
    } else {
      console.log(`rodada ${rodada}: sem posição estimada`);
    }
  }

  // Encerra as viagens simuladas (o ônibus "some" do mapa)
  for (const celular of celulares) await api("POST", `/viagens/${celular.viagemId}/encerrar`, celular.token);

  const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  if (errosLogo.length > 0) {
    console.log(
      `\nErro médio logo após envio: ${media(errosLogo).toFixed(1)} m | ` +
        `antes do próximo envio: ${media(errosAntes).toFixed(1)} m`,
    );
  }

  mkdirSync("scripts/resultados", { recursive: true });
  const arquivo = `scripts/resultados/simulacao-${DISPOSITIVOS}disp-${INTERVALO_S}s-${Date.now()}.csv`;
  writeFileSync(arquivo, linhasCsv.join("\n"), "utf8");
  console.log(`Resultados salvos em ${arquivo}`);
}

main().catch((erro) => {
  console.error("Falha na simulação:", erro.message);
  process.exit(1);
});