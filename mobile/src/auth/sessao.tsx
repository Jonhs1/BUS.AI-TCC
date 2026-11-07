import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { ErroApi, requisitar } from "@/api/cliente";
import { CHAVE_TOKEN } from "@/auth/token";
import { carregarEnderecoSalvo } from "@/config";
import { pararSegundoPlanoSeAtivo } from "@/viagem/segundo-plano";

// Mesmo formato de "usuario" em GET /usuarios/me (docs/API.md, seção 3)
export type Usuario = {
  id: number;
  nome: string;
  email: string;
  curso: string | null;
  linhaId: number | null;
  consentiuLocalizacaoEm: string | null;
  criadoEm: string;
};

type DadosCadastro = { nome: string; email: string; senha: string; curso?: string };

type Sessao = {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: DadosCadastro) => Promise<void>;
  sair: () => Promise<void>;
  // Depois de mudar o perfil no backend (ônibus, consentimento), guarda a versão nova aqui
  atualizarUsuario: (usuario: Usuario | null) => void;
  // Para as próximas telas: chama o backend já com o token e desloga sozinho no 401
  api: <T>(caminho: string, opcoes?: Omit<Parameters<typeof requisitar>[1], "token">) => Promise<T>;
};


const ContextoSessao = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const sair = useCallback(async () => {
    // No Android (APK), a coleta em segundo plano não depende das telas: desliga explicitamente
    await pararSegundoPlanoSeAtivo();
    await SecureStore.deleteItemAsync(CHAVE_TOKEN);
    setToken(null);
    setUsuario(null);
  }, []);

  // Ao abrir o app: se já existe um token guardado, confere com o backend se ele ainda vale
  useEffect(() => {
    (async () => {
      try {
        // Primeiro o endereço do servidor (pode ter sido trocado no app); depois o token
        await carregarEnderecoSalvo();
        const salvo = await SecureStore.getItemAsync(CHAVE_TOKEN);
        if (salvo) {
          const { usuario } = await requisitar<{ usuario: Usuario }>("/usuarios/me", { token: salvo });
          setToken(salvo);
          setUsuario(usuario);
        }
      } catch (erro) {
        // Token vencido (vale 7 dias): volta para o login. Sem internet: também, por enquanto.
        if (erro instanceof ErroApi && erro.status === 401) await SecureStore.deleteItemAsync(CHAVE_TOKEN);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await requisitar<{ token: string; usuario: Usuario }>("/auth/login", {
      metodo: "POST",
      corpo: { email, senha },
    });
    await SecureStore.setItemAsync(CHAVE_TOKEN, resposta.token);
    // O login devolve só parte do perfil; /usuarios/me traz linha e consentimento
    const { usuario } = await requisitar<{ usuario: Usuario }>("/usuarios/me", { token: resposta.token });
    setToken(resposta.token);
    setUsuario(usuario);
  }, []);

  const cadastrar = useCallback(
    async (dados: DadosCadastro) => {
      await requisitar("/auth/cadastro", { metodo: "POST", corpo: dados });
      // O cadastro não devolve token: entra logo em seguida com os mesmos dados
      await entrar(dados.email, dados.senha);
    },
    [entrar],
  );

  const api = useCallback<Sessao["api"]>(
    async (caminho, opcoes) => {
      try {
        return await requisitar(caminho, { ...opcoes, token });
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) await sair();
        throw erro;
      }
    },
    [token, sair],
  );

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, cadastrar, sair, atualizarUsuario: setUsuario, api }),
    [usuario, carregando, entrar, cadastrar, sair, api],
  );

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

export function useSessao() {
  const sessao = useContext(ContextoSessao);
  if (!sessao) throw new Error("useSessao precisa estar dentro de <ProvedorSessao>");
  return sessao;
}
