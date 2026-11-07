// Coleta de localização EM SEGUNDO PLANO, usada só no APK do Android (EAS Build).
// Continua enviando com a tela bloqueada ou com outro app aberto, até o aluno tocar em "Desci".
//
// Por que é diferente do modo com tela ligada (compartilhamento.tsx):
// - O Android entrega as posições a uma TAREFA registrada no sistema, e não à tela.
//   A tarefa pode rodar com o app fora da tela, então não pode guardar nada em useState/useRef.
// - Por isso a fila de leituras e os contadores ficam no armazenamento do celular (AsyncStorage),
//   e a tela só LÊ esses valores para mostrar no cartão.
// - O Android exige uma notificação fixa enquanto a localização é usada em segundo plano
//   ("foreground service"): é ela que avisa o aluno de que o compartilhamento está ligado.
//
// No Expo Go (iPhone e Android) nada disto roda: o Expo Go não permite tarefas em segundo plano.
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { ErroApi, requisitar } from "@/api/cliente";
import { CHAVE_TOKEN } from "@/auth/token";
import { carregarEnderecoSalvo } from "@/config";
import { cores } from "@/theme";
import { INTERVALO_MS, MAX_POR_LOTE, type Leitura } from "@/viagem/parametros";

export const TAREFA_LOCALIZACAO = "busai-localizacao";

const emExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// true = APK do Android: coleta em segundo plano. false = Expo Go: coleta só com a tela ligada.
export const MODO_SEGUNDO_PLANO = Platform.OS === "android" && !emExpoGo;

const CHAVE_ESTADO = "busai.coleta.estado";
const CHAVE_FILA = "busai.coleta.fila";

type Estado = {
  viagemId: number;
  iniciadaEmMs: number;
  enviadas: number;
  ultimoEnvioMs: number | null;
  ultimoEnfileiradoMs: number;
  precisaoM: number | null;
  aviso: string | null;
};

export type ResumoColeta = {
  ativa: boolean; // a tarefa está recebendo posições
  viagemId: number | null;
  enviadas: number;
  naFila: number;
  precisaoM: number | null;
  ultimoEnvio: Date | null;
  aviso: string | null;
};

// ───────────── Armazenamento ─────────────

async function lerEstado(): Promise<Estado | null> {
  const texto = await AsyncStorage.getItem(CHAVE_ESTADO);
  return texto ? (JSON.parse(texto) as Estado) : null;
}

async function salvarEstado(estado: Estado | null) {
  if (estado) await AsyncStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado));
  else await AsyncStorage.removeItem(CHAVE_ESTADO);
}

async function atualizarEstado(mudancas: Partial<Estado>) {
  const estado = await lerEstado();
  if (estado) await salvarEstado({ ...estado, ...mudancas });
}

async function lerFila(): Promise<Leitura[]> {
  const texto = await AsyncStorage.getItem(CHAVE_FILA);
  return texto ? (JSON.parse(texto) as Leitura[]) : [];
}

async function salvarFila(fila: Leitura[]) {
  await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
}

// ───────────── Recebimento das posições ─────────────

// Guarda as posições novas na fila, no máximo uma a cada ~5 s, como no modo com tela ligada.
// Assim os dois modos produzem dados comparáveis para a análise do TCC.
async function registrarPosicoes(posicoes: Location.LocationObject[]) {
  const estado = await lerEstado();
  if (!estado) return;
  const fila = await lerFila();
  let ultimo = estado.ultimoEnfileiradoMs;
  let precisao = estado.precisaoM;

  for (const p of [...posicoes].sort((a, b) => a.timestamp - b.timestamp)) {
    precisao = p.coords.accuracy ?? null;
    // Antes do embarque: o backend recusaria o lote inteiro
    if (p.timestamp < estado.iniciadaEmMs) continue;
    // Mais de uma posição no mesmo intervalo: fica só com a primeira (folga de 0,5 s)
    if (p.timestamp - ultimo < INTERVALO_MS - 500) continue;
    fila.push({
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      precisaoMetros: p.coords.accuracy ?? null,
      registradaEm: p.timestamp,
    });
    ultimo = p.timestamp;
  }

  await salvarFila(fila);
  await salvarEstado({ ...estado, ultimoEnfileiradoMs: ultimo, precisaoM: precisao });
}

// ───────────── Envio ─────────────

let enviando = false;

// Envia o começo da fila para a API. Chamado pela tarefa a cada posição nova e pela tela ao encerrar.
export async function enviarFila() {
  if (enviando) return;
  enviando = true;
  try {
    const estado = await lerEstado();
    const fila = await lerFila();
    if (!estado || fila.length === 0) return;

    const token = await SecureStore.getItemAsync(CHAVE_TOKEN);
    if (!token) {
      await encerrarLocalmente("Sessão encerrada: entre de novo no app.");
      return;
    }
    // A tarefa pode rodar sem a tela: carrega o endereço do servidor salvo no celular
    await carregarEnderecoSalvo();

    const lote = fila.slice(0, MAX_POR_LOTE);
    try {
      const r = await requisitar<{ recebidas: number }>(`/viagens/${estado.viagemId}/leituras`, {
        metodo: "POST",
        corpo: { leituras: lote },
        token,
      });
      // Só tira da fila depois que o servidor confirmou. Relê a fila: a tarefa pode ter
      // acrescentado posições no fim enquanto o envio acontecia.
      await salvarFila((await lerFila()).slice(lote.length));
      await atualizarEstado({ enviadas: estado.enviadas + r.recebidas, ultimoEnvioMs: Date.now(), aviso: null });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) {
        // Viagem encerrada ou expirada no servidor (ex.: consentimento revogado no Perfil)
        await encerrarLocalmente("Compartilhamento encerrado pelo servidor.");
      } else if (e instanceof ErroApi && e.status === 401) {
        await encerrarLocalmente("Sessão expirada: entre de novo no app.");
      } else if (e instanceof ErroApi && e.status === 400) {
        // Lote recusado: descarta para não travar a fila tentando o mesmo envio para sempre
        await salvarFila((await lerFila()).slice(lote.length));
        await atualizarEstado({ aviso: `Leituras recusadas: ${e.message}` });
      } else {
        // Sem internet: as leituras continuam na fila e vão no próximo envio
        await atualizarEstado({ aviso: `Sem conexão. ${fila.length} leitura(s) guardada(s) para enviar depois.` });
      }
    }
  } finally {
    enviando = false;
  }
}

// Para a coleta sem falar com a API (o servidor já encerrou, ou a sessão acabou)
async function encerrarLocalmente(aviso: string) {
  if (await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO)) {
    await Location.stopLocationUpdatesAsync(TAREFA_LOCALIZACAO);
  }
  await atualizarEstado({ aviso });
}

// ───────────── Tarefa registrada no sistema ─────────────

// Precisa estar no nível do módulo (fora de componentes), e o módulo precisa ser importado
// logo que o app abre: o Android pode chamar a tarefa antes de qualquer tela aparecer.
if (MODO_SEGUNDO_PLANO) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREFA_LOCALIZACAO, async ({ data, error }) => {
    if (error) {
      await atualizarEstado({ aviso: `GPS: ${error.message}` });
      return;
    }
    if (!data?.locations?.length) return;
    await registrarPosicoes(data.locations);
    await enviarFila();
  });
}

// ───────────── Usado pela tela ─────────────

// Pede "Permitir o tempo todo". No Android 11+ o sistema abre a tela de Configurações,
// então o app explica antes o que o aluno precisa escolher.
export async function garantirPermissaoSegundoPlano() {
  const primeiro = await Location.requestForegroundPermissionsAsync();
  if (!primeiro.granted) throw new Error("Sem permissão de localização. Libere nas Configurações do celular.");

  if ((await Location.getBackgroundPermissionsAsync()).granted) return;

  await new Promise<void>((continuar) =>
    Alert.alert(
      "Compartilhar com a tela bloqueada",
      "Para continuar enviando a posição do ônibus com a tela bloqueada, escolha “Permitir o tempo todo” na próxima tela. " +
        "O BUS.AI só usa a localização entre “Estou no ônibus” e “Desci do ônibus”, e mostra uma notificação enquanto isso.",
      [{ text: "Continuar", onPress: () => continuar() }],
      { cancelable: false },
    ),
  );

  const segundo = await Location.requestBackgroundPermissionsAsync();
  if (!segundo.granted) {
    throw new Error("Escolha “Permitir o tempo todo” na localização do BUS.AI, nas Configurações do celular.");
  }
}

// Começa a receber posições. manterFila = retomar uma viagem que ficou aberta, sem perder o que não foi enviado.
export async function iniciarSegundoPlano(viagem: { id: number; iniciadaEm: string }, manterFila = false) {
  const salvo = await lerEstado();
  // Estado anterior só é aproveitado se for da mesma viagem
  const anterior = manterFila && salvo && salvo.viagemId === viagem.id ? salvo : null;
  await salvarEstado({
    viagemId: viagem.id,
    iniciadaEmMs: new Date(viagem.iniciadaEm).getTime(),
    enviadas: anterior?.enviadas ?? 0,
    ultimoEnvioMs: anterior?.ultimoEnvioMs ?? null,
    ultimoEnfileiradoMs: anterior?.ultimoEnfileiradoMs ?? 0,
    precisaoM: null,
    aviso: null,
  });
  if (!anterior) await salvarFila([]);

  await Location.startLocationUpdatesAsync(TAREFA_LOCALIZACAO, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: INTERVALO_MS,
    distanceInterval: 0,
    foregroundService: {
      notificationTitle: "BUS.AI: compartilhando a localização do ônibus",
      notificationBody: "Toque em “Desci do ônibus” no app para parar.",
      notificationColor: cores.primaria,
      // Se o aluno fechar o app pela lista de recentes, o compartilhamento continua até "Desci"
      killServiceOnDestroy: false,
    },
  });
}

// Botão "Desci": para o GPS, tenta mandar o que sobrou e limpa tudo
export async function pararSegundoPlano(): Promise<{ enviadas: number; pendentes: number }> {
  if (await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO)) {
    await Location.stopLocationUpdatesAsync(TAREFA_LOCALIZACAO);
  }
  await enviarFila();
  const estado = await lerEstado();
  const pendentes = (await lerFila()).length;
  await salvarEstado(null);
  await salvarFila([]);
  return { enviadas: estado?.enviadas ?? 0, pendentes };
}

// Ao sair da conta: desliga sem enviar nada (o token está sendo apagado)
export async function pararSegundoPlanoSeAtivo() {
  if (!MODO_SEGUNDO_PLANO) return;
  if (await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO)) {
    await Location.stopLocationUpdatesAsync(TAREFA_LOCALIZACAO);
  }
  await salvarEstado(null);
  await salvarFila([]);
}

// O que o cartão "Compartilhando localização" mostra
export async function lerResumo(): Promise<ResumoColeta> {
  const [estado, fila, ativa] = await Promise.all([
    lerEstado(),
    lerFila(),
    Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO),
  ]);
  return {
    ativa,
    viagemId: estado?.viagemId ?? null,
    enviadas: estado?.enviadas ?? 0,
    naFila: fila.length,
    precisaoM: estado?.precisaoM ?? null,
    ultimoEnvio: estado?.ultimoEnvioMs ? new Date(estado.ultimoEnvioMs) : null,
    aviso: estado?.aviso ?? null,
  };
}
