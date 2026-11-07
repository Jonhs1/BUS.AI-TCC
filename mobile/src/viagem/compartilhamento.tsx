import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Location from "expo-location";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ErroApi } from "@/api/cliente";
import { useSessao } from "@/auth/sessao";
import { INTERVALO_MS, MAX_POR_LOTE, type Leitura } from "@/viagem/parametros";
import {
  garantirPermissaoSegundoPlano,
  iniciarSegundoPlano,
  lerResumo,
  MODO_SEGUNDO_PLANO,
  pararSegundoPlano,
} from "@/viagem/segundo-plano";

export { INTERVALO_ENVIO_S, PRECISAO_MAXIMA_M } from "@/viagem/parametros";
export { MODO_SEGUNDO_PLANO } from "@/viagem/segundo-plano";

// Dois modos de coleta, escolhidos pelo ambiente em que o app roda:
// - Expo Go (iPhone e Android): GPS e envio dentro da tela, que precisa ficar ligada (este arquivo).
// - APK do Android (EAS Build): tarefa em segundo plano (segundo-plano.ts); esta tela só mostra os números.
const TAG_TELA = "busai-viagem";

// Formato de POST /viagens e GET /viagens/atual (docs/API.md, seção 7)
export type Viagem = {
  id: number;
  iniciadaEm: string;
  encerradaEm: string | null;
  usuarioId: number;
  linhaId: number;
};

type Compartilhamento = {
  viagem: Viagem | null; // viagem aberta no backend (pode existir sem coleta, ao reabrir o app)
  coletando: boolean; // GPS ligado e enviando
  enviadas: number;
  naFila: number; // medidas que ainda não chegaram ao servidor (ex.: sem sinal na estrada)
  precisaoM: number | null;
  ultimoEnvio: Date | null;
  aviso: string | null;
  embarcar: () => Promise<void>;
  continuar: () => Promise<void>;
  desembarcar: () => Promise<void>;
};

const Contexto = createContext<Compartilhamento | null>(null);

// Fica acima das abas: o envio continua enquanto o aluno troca de tela dentro do app
export function ProvedorViagem({ children }: { children: ReactNode }) {
  const { api, usuario } = useSessao();
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [coletando, setColetando] = useState(false);
  const [enviadas, setEnviadas] = useState(0);
  const [naFila, setNaFila] = useState(0);
  const [precisaoM, setPrecisaoM] = useState<number | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<Date | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // useRef guarda valores que mudam o tempo todo SEM redesenhar a tela.
  // O temporizador lê daqui, e não do useState, para enxergar sempre o valor atual.
  const viagemRef = useRef<Viagem | null>(null);
  const fila = useRef<Leitura[]>([]);
  const ultimaLeitura = useRef<Leitura | null>(null);
  const ultimoEnfileirado = useRef(0);
  const enviando = useRef(false);
  const observador = useRef<Location.LocationSubscription | null>(null);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);

  function definirViagem(v: Viagem | null) {
    viagemRef.current = v;
    setViagem(v);
  }

  // Ao entrar no app: descobre se ficou uma viagem aberta (ex.: o app foi fechado no meio)
  useEffect(() => {
    if (!usuario) return;
    api<{ viagem: Viagem | null }>("/viagens/atual")
      .then((r) => definirViagem(r.viagem))
      .catch(() => {});
  }, [usuario, api]);

  // Segundo plano: a tarefa grava os números no celular; a tela os lê a cada 2 s
  const atualizarResumo = useCallback(async () => {
    const r = await lerResumo();
    setEnviadas(r.enviadas);
    setNaFila(r.naFila);
    setPrecisaoM(r.precisaoM);
    setUltimoEnvio(r.ultimoEnvio);
    setAviso(r.aviso);
    if (!r.ativa) {
      // A tarefa parou sozinha (servidor encerrou a viagem ou a sessão expirou)
      setColetando(false);
      if (r.aviso) definirViagem(null);
    }
  }, []);

  // Ao abrir o app no APK: a coleta pode estar rodando desde antes (tela bloqueada, app fechado)
  useEffect(() => {
    if (!usuario || !MODO_SEGUNDO_PLANO) return;
    lerResumo()
      .then((r) => {
        if (r.ativa) setColetando(true);
      })
      .catch(() => {});
  }, [usuario]);

  useEffect(() => {
    if (!MODO_SEGUNDO_PLANO || !coletando) return;
    atualizarResumo();
    const relogio = setInterval(atualizarResumo, 2000);
    return () => clearInterval(relogio);
  }, [coletando, atualizarResumo]);

  const pararColeta = useCallback(() => {
    observador.current?.remove();
    observador.current = null;
    if (temporizador.current) clearInterval(temporizador.current);
    temporizador.current = null;
    deactivateKeepAwake(TAG_TELA);
    setColetando(false);
  }, []);

  // Se o aluno sair da conta, esta parte do app é desmontada: desliga o GPS junto.
  // (No modo segundo plano, quem desliga a tarefa no logout é a sessão: a tela pode ser
  // desmontada pelo sistema sem que o aluno tenha descido do ônibus.)
  useEffect(() => pararColeta, [pararColeta]);

  function registrar(p: Location.LocationObject) {
    ultimaLeitura.current = {
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      precisaoMetros: p.coords.accuracy ?? null,
      registradaEm: p.timestamp,
    };
    setPrecisaoM(p.coords.accuracy ?? null);
  }

  // Coloca a última medida na fila, sem repetir a mesma e sem medidas de antes do embarque
  // (o backend recusa o lote inteiro se houver leitura fora do período da viagem)
  function enfileirar() {
    const leitura = ultimaLeitura.current;
    const v = viagemRef.current;
    if (!leitura || !v) return;
    if (leitura.registradaEm <= ultimoEnfileirado.current) return;
    if (leitura.registradaEm < new Date(v.iniciadaEm).getTime()) return;
    fila.current.push(leitura);
    ultimoEnfileirado.current = leitura.registradaEm;
    setNaFila(fila.current.length);
  }

  const enviarFila = useCallback(async () => {
    const v = viagemRef.current;
    if (!v || enviando.current || fila.current.length === 0) return;
    enviando.current = true;
    const lote = fila.current.slice(0, MAX_POR_LOTE);
    try {
      const r = await api<{ recebidas: number }>(`/viagens/${v.id}/leituras`, {
        metodo: "POST",
        corpo: { leituras: lote },
      });
      // Só tira da fila depois que o servidor confirmou
      fila.current = fila.current.slice(lote.length);
      setEnviadas((n) => n + r.recebidas);
      setUltimoEnvio(new Date());
      setAviso(null);
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) {
        // Viagem encerrada ou expirada no servidor (ex.: consentimento revogado no Perfil)
        pararColeta();
        definirViagem(null);
        setAviso("Compartilhamento encerrado pelo servidor.");
      } else if (e instanceof ErroApi && e.status === 400) {
        // Lote recusado: descarta para não travar a fila tentando o mesmo envio para sempre
        fila.current = fila.current.slice(lote.length);
        setAviso(`Leituras recusadas: ${e.message}`);
      } else {
        // Sem internet: as leituras continuam na fila e vão no próximo envio
        setAviso(`Sem conexão. ${fila.current.length} leitura(s) guardada(s) para enviar depois.`);
      }
    } finally {
      enviando.current = false;
      setNaFila(fila.current.length);
    }
  }, [api, pararColeta]);

  async function garantirPermissao() {
    const atual = await Location.getForegroundPermissionsAsync();
    if (atual.granted) return;
    const pedido = await Location.requestForegroundPermissionsAsync();
    if (!pedido.granted) {
      throw new Error("Sem permissão de localização. Libere nas Configurações do celular.");
    }
  }

  const iniciarColeta = useCallback(async () => {
    fila.current = [];
    ultimaLeitura.current = null;
    ultimoEnfileirado.current = 0;
    setEnviadas(0);
    setNaFila(0);
    setUltimoEnvio(null);
    setPrecisaoM(null);

    // Recebe posições do GPS continuamente, com a maior precisão disponível
    observador.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: INTERVALO_MS, distanceInterval: 0 },
      registrar,
      (erro) => setAviso(`GPS: ${erro}`),
    );

    // A cada intervalo: garante uma medida nova, coloca na fila e tenta enviar
    temporizador.current = setInterval(async () => {
      const semNovidade = !ultimaLeitura.current || ultimaLeitura.current.registradaEm <= ultimoEnfileirado.current;
      if (semNovidade) {
        // Parado, o celular pode não gerar posição nova sozinho: pede uma medição agora
        try {
          registrar(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }));
        } catch {
          // Sem GPS neste instante: tenta de novo no próximo intervalo
        }
      }
      enfileirar();
      enviarFila();
    }, INTERVALO_MS);

    // No Expo Go, o envio só funciona com o app aberto: impede a tela de apagar
    await activateKeepAwakeAsync(TAG_TELA);
    setColetando(true);
  }, [enviarFila]);

  // Botão "Estou no ônibus"
  const embarcar = useCallback(async () => {
    setAviso(null);
    // Antes de criar a viagem: sem permissão de GPS, não adianta abrir
    if (MODO_SEGUNDO_PLANO) await garantirPermissaoSegundoPlano();
    else await garantirPermissao();
    const r = await api<{ viagem: Viagem }>("/viagens", { metodo: "POST" }); // usa o ônibus do perfil
    definirViagem(r.viagem);
    if (MODO_SEGUNDO_PLANO) {
      await iniciarSegundoPlano(r.viagem);
      setEnviadas(0);
      setNaFila(0);
      setUltimoEnvio(null);
      setPrecisaoM(null);
      setColetando(true);
    } else {
      await iniciarColeta();
    }
  }, [api, iniciarColeta]);

  // Viagem que ficou aberta: volta a enviar sem criar outra
  const continuar = useCallback(async () => {
    setAviso(null);
    if (MODO_SEGUNDO_PLANO) {
      const v = viagemRef.current;
      if (!v) return;
      await garantirPermissaoSegundoPlano();
      await iniciarSegundoPlano(v, true); // mantém o que ainda não foi enviado
      setColetando(true);
      return;
    }
    await garantirPermissao();
    await iniciarColeta();
  }, [iniciarColeta]);

  // Botão "Desci do ônibus"
  const desembarcar = useCallback(async () => {
    const v = viagemRef.current;
    if (!v) return;
    let pendentes: number;
    if (MODO_SEGUNDO_PLANO) {
      // Para a tarefa, tenta mandar o que sobrou na fila e guarda o total para o cartão
      const final = await pararSegundoPlano();
      pendentes = final.pendentes;
      setEnviadas(final.enviadas);
      setNaFila(0);
      setColetando(false);
    } else {
      enfileirar();
      await enviarFila(); // tenta mandar o que ainda está na fila antes de encerrar
      pararColeta();
      pendentes = fila.current.length;
    }
    try {
      await api(`/viagens/${v.id}/encerrar`, { metodo: "POST" });
    } catch {
      // Sem internet: o servidor encerra sozinho depois de 3 horas
    }
    definirViagem(null);
    setAviso(pendentes > 0 ? `Viagem encerrada. ${pendentes} leitura(s) não puderam ser enviadas.` : null);
  }, [api, enviarFila, pararColeta]);

  const valor = useMemo(
    () => ({ viagem, coletando, enviadas, naFila, precisaoM, ultimoEnvio, aviso, embarcar, continuar, desembarcar }),
    [viagem, coletando, enviadas, naFila, precisaoM, ultimoEnvio, aviso, embarcar, continuar, desembarcar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useViagem() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useViagem precisa estar dentro de <ProvedorViagem>");
  return contexto;
}
