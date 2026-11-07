import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ErroApi } from "@/api/cliente";
import { useSessao } from "@/auth/sessao";

// Formato de GET /recomendacoes (docs/API.md, seção 5)
export type Recomendacao = {
  atividadeId: number;
  titulo: string;
  categoria: "ESTUDO" | "BIBLIOTECA" | "ALIMENTACAO" | "SECRETARIA" | "OUTRO";
  local: string;
  pontuacao: number; // 0 a 100, calculada pelo motor do backend
  idaMin: number; // caminhada até a atividade
  voltaMin: number; // caminhada da atividade até o próximo compromisso
  totalMin: number; // ida + atividade + volta + margem de segurança
  folgaMin: number; // o que ainda sobra do intervalo
  justificativa: string; // texto pronto explicando por que cabe
};

export type Janela = {
  inicio: string; // "HH:MM"
  fim: string;
  minutosLivres: number;
  proximoCompromisso: string;
};

export type RespostaRecomendacoes = {
  diaSemana: number;
  agora: string;
  janela: Janela | null; // null = nenhum compromisso restante no dia
  mensagem?: string;
  recomendacoes: Recomendacao[]; // já ordenadas da maior para a menor pontuação
  descartadas: { titulo: string; motivo: string }[];
};

// Modo demonstração: o backend calcula "como se fosse" este dia e esta hora
export type Simulacao = { dia: number; hora: string };

export const nomeCategoria: Record<Recomendacao["categoria"], string> = {
  ESTUDO: "Estudo",
  BIBLIOTECA: "Biblioteca",
  ALIMENTACAO: "Alimentação",
  SECRETARIA: "Secretaria",
  OUTRO: "Outro",
};

// Busca as recomendações ao abrir a tela e sempre que a simulação mudar.
// Não envia lat/lng: a tela de consentimento promete usar a localização só durante a viagem.
// Sem posição, o backend parte do local da última aula do dia (ver motor.ts).
export function useRecomendacoes(simulacao: Simulacao | null) {
  const { api } = useSessao();
  const [dados, setDados] = useState<RespostaRecomendacoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const parametros = simulacao ? `?dia=${simulacao.dia}&hora=${encodeURIComponent(simulacao.hora)}` : "";
      const resposta = await api<RespostaRecomendacoes>(`/recomendacoes${parametros}`);
      setDados(resposta);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar as sugestões.");
    } finally {
      setCarregando(false);
    }
  }, [api, simulacao]);

  // Roda ao voltar para a aba (ex.: depois de cadastrar uma aula) e quando "carregar" muda
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  return { dados, carregando, erro, recarregar: carregar };
}
