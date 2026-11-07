import AsyncStorage from "@react-native-async-storage/async-storage";

// Endereço do backend. Há duas fontes, nesta ordem de prioridade:
//   1. O endereço digitado no próprio app (tela Entrar → "Servidor"), guardado no celular.
//      É o que o APK do Android usa: o endereço do túnel muda a cada reinício, e não dá
//      para gerar um APK novo toda vez.
//   2. O arquivo mobile/.env.local (EXPO_PUBLIC_API_URL), usado no Expo Go durante o desenvolvimento.

const CHAVE_SERVIDOR = "busai.servidor";

// Remove espaços e barras no final ("...com/" viraria "...com//auth/login")
export function limparEndereco(endereco: string) {
  return endereco.trim().replace(/\/+$/, "");
}

export const ENDERECO_DO_ARQUIVO = limparEndereco(process.env.EXPO_PUBLIC_API_URL ?? "");

let enderecoAtual = ENDERECO_DO_ARQUIVO;

export function obterApiUrl() {
  return enderecoAtual;
}

// Chamado ao abrir o app (e pela tarefa em segundo plano): usa o endereço salvo, se houver
export async function carregarEnderecoSalvo() {
  try {
    const salvo = await AsyncStorage.getItem(CHAVE_SERVIDOR);
    if (salvo) enderecoAtual = salvo;
  } catch {
    // Sem acesso ao armazenamento: continua com o endereço do arquivo
  }
  return enderecoAtual;
}

// Endereço vazio = apaga o salvo e volta a usar o do arquivo .env.local
export async function definirEnderecoServidor(endereco: string) {
  const limpo = limparEndereco(endereco);
  if (limpo && !/^https?:\/\//.test(limpo)) {
    throw new Error("O endereço precisa começar com https:// (ou http:// na rede local).");
  }
  if (limpo) {
    await AsyncStorage.setItem(CHAVE_SERVIDOR, limpo);
    enderecoAtual = limpo;
  } else {
    await AsyncStorage.removeItem(CHAVE_SERVIDOR);
    enderecoAtual = ENDERECO_DO_ARQUIVO;
  }
  return enderecoAtual;
}
