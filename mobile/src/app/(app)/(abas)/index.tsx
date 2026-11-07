import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { diasCurtos, diasLongos } from "@/api/compromissos";
import { useRecomendacoes, type Simulacao } from "@/api/recomendacoes";
import { useSessao } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { CampoHorario } from "@/components/campo-horario";
import { CartaoRecomendacao } from "@/components/cartao-recomendacao";
import { CartaoViagem } from "@/components/cartao-viagem";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// Tela "Início": botão "Estou no ônibus", intervalo livre até o próximo compromisso + atividades que cabem nele
export default function Inicio() {
  const { usuario } = useSessao();
  const margens = useSafeAreaInsets();
  const primeiroNome = usuario?.nome.split(" ")[0] ?? "";

  // null = usa o dia e a hora reais. Com valor = modo demonstração (para testes e para a banca)
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const { dados, carregando, erro, recarregar } = useRecomendacoes(simulacao);
  const [verDescartadas, setVerDescartadas] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  // Como no fluxo do Figma (Entrar → Permitir localização → Início): pergunta uma única vez
  // por aluno. Se ele tocar em "Agora não", não insiste; dá para ligar depois no Perfil.
  useEffect(() => {
    if (!usuario || usuario.consentiuLocalizacaoEm) return;
    const chave = `busai.perguntouLocalizacao.${usuario.id}`;
    (async () => {
      if (await SecureStore.getItemAsync(chave)) return;
      await SecureStore.setItemAsync(chave, "sim");
      router.push("/permitir-localizacao");
    })();
  }, [usuario]);

  async function puxarParaAtualizar() {
    setAtualizando(true);
    await recarregar();
    setAtualizando(false);
  }

  function ligarDemonstracao(ligado: boolean) {
    // Começa no dia de hoje às 14:00, o exemplo do problema do TCC
    setSimulacao(ligado ? { dia: new Date().getDay(), hora: "14:00" } : null);
    setVerDescartadas(false);
  }

  const janela = dados?.janela ?? null;
  // Se o aluno está em aula, a janela começa quando a aula termina (regra do motor no backend)
  const livreAgora = janela !== null && janela.inicio === dados?.agora;

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + 16 }]}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={puxarParaAtualizar} tintColor={cores.primaria} />}
    >
      <View style={{ gap: 4 }}>
        <Text style={estilos.subtitulo}>{simulacao ? "Modo demonstração" : "Seu dia no BUS.AI"}</Text>
        <Text style={estilos.titulo}>{`${saudacao()}, ${primeiroNome}`}</Text>
      </View>

      {/* ───── Estou no ônibus (etapa 6) ───── */}
      <CartaoViagem />

      {/* ───── Modo demonstração ───── */}
      <View style={estilos.cartao}>
        <View style={estilos.linhaDemo}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={estilos.tituloCartao}>Simular dia e hora</Text>
            <Text style={estilos.subtitulo}>Veja as sugestões como se fosse outro momento.</Text>
          </View>
          <Switch
            value={simulacao !== null}
            onValueChange={ligarDemonstracao}
            trackColor={{ true: cores.primaria, false: cores.borda }}
            accessibilityLabel="Simular dia e hora"
          />
        </View>

        {simulacao ? (
          <View style={{ gap: 12 }}>
            <View style={estilos.dias}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const ativo = d === simulacao.dia;
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: ativo }}
                    accessibilityLabel={diasLongos[d]}
                    onPress={() => setSimulacao({ ...simulacao, dia: d })}
                    style={[estilos.dia, ativo && estilos.diaAtivo]}
                  >
                    <Text style={[estilos.diaNome, ativo && { color: cores.superficie }]}>{diasCurtos[d]}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Em linha, porque o CampoHorario ocupa a largura disponível (flex: 1) */}
            <View style={{ flexDirection: "row" }}>
              <CampoHorario rotulo="Hora" valor={simulacao.hora} onChange={(hora) => setSimulacao({ ...simulacao, hora })} />
            </View>
          </View>
        ) : null}
      </View>

      {/* ───── Resultado ───── */}
      {carregando && !dados ? (
        <ActivityIndicator color={cores.primaria} style={{ marginTop: 24 }} />
      ) : erro ? (
        <View style={{ gap: 12 }}>
          <Text style={estilos.erro}>{erro}</Text>
          <Botao tipo="secundario" rotulo="Tentar de novo" onPress={recarregar} />
        </View>
      ) : !janela ? (
        <View style={estilos.vazio}>
          <Text style={estilos.tituloCartao}>Nenhum compromisso restante {simulacao ? "neste dia" : "hoje"}</Text>
          <Text style={estilos.subtitulo}>
            As sugestões aparecem quando há um intervalo antes da próxima aula. Cadastre suas aulas na aba Horários ou
            use a simulação acima.
          </Text>
        </View>
      ) : (
        <>
          <View style={estilos.janela}>
            <View style={estilos.linhaJanela}>
              <Icone nome="brilho" tamanho={16} cor={cores.superficie} />
              <Text style={estilos.rotuloJanela}>{livreAgora ? "Tempo livre agora" : "Próximo intervalo"}</Text>
              {carregando ? <ActivityIndicator color={cores.superficie} style={{ marginLeft: "auto" }} /> : null}
            </View>
            <Text style={estilos.minutos}>{janela.minutosLivres} min</Text>
            <Text style={estilos.textoJanela}>
              {janela.inicio} – {janela.fim} · antes de “{janela.proximoCompromisso}”
            </Text>
          </View>

          <Text style={estilos.secao}>Sugestões para o intervalo</Text>

          {dados && dados.recomendacoes.length > 0 ? (
            <View style={{ gap: 10 }}>
              {dados.recomendacoes.map((r, i) => (
                <CartaoRecomendacao key={r.atividadeId} item={r} destaque={i === 0} />
              ))}
            </View>
          ) : (
            <View style={estilos.vazio}>
              <Text style={estilos.tituloCartao}>Nenhuma atividade cabe nesse intervalo</Text>
              <Text style={estilos.subtitulo}>O tempo livre não é suficiente para ir, fazer a atividade e voltar a tempo.</Text>
            </View>
          )}

          {dados && dados.descartadas.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVerDescartadas((v) => !v)}
                style={({ pressed }) => [estilos.verMais, pressed && { opacity: 0.7 }]}
              >
                <Text style={estilos.textoVerMais}>
                  {verDescartadas ? "Esconder" : "Ver"} atividades que não cabem ({dados.descartadas.length})
                </Text>
              </Pressable>
              {verDescartadas
                ? dados.descartadas.map((d) => (
                    <View key={d.titulo} style={estilos.descartada}>
                      <Text style={estilos.tituloDescartada}>{d.titulo}</Text>
                      <Text style={estilos.subtitulo}>{d.motivo}</Text>
                    </View>
                  ))
                : null}
            </View>
          ) : null}
        </>
      )}

      <Text style={estilos.nota}>
        As sugestões são calculadas por regras: só entram atividades em que ida, duração, volta e uma margem de 5 min
        cabem no intervalo; depois, são ordenadas por aproveitamento do tempo e proximidade.
      </Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  titulo: { fontSize: 26, fontWeight: "700", color: cores.texto },
  subtitulo: { fontSize: 13, lineHeight: 18, color: cores.textoSuave },
  cartao: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  tituloCartao: { fontSize: 15, fontWeight: "600", color: cores.texto },
  linhaDemo: { flexDirection: "row", alignItems: "center", gap: 12 },
  dias: { flexDirection: "row", gap: 6 },
  dia: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  diaAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  diaNome: { fontSize: 13, fontWeight: "600", color: cores.texto },
  erro: { fontSize: 14, color: cores.perigo },
  vazio: { padding: 20, gap: 6, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: cores.borda },
  janela: { gap: 4, padding: 20, borderRadius: 20, backgroundColor: cores.marinho },
  linhaJanela: { flexDirection: "row", alignItems: "center", gap: 8 },
  rotuloJanela: { fontSize: 13, fontWeight: "600", color: cores.superficie, opacity: 0.85 },
  minutos: { fontSize: 40, fontWeight: "700", color: cores.superficie },
  textoJanela: { fontSize: 14, color: cores.superficie, opacity: 0.85 },
  secao: { fontSize: 16, fontWeight: "700", color: cores.texto },
  verMais: { paddingVertical: 8 },
  textoVerMais: { fontSize: 14, fontWeight: "600", color: cores.primaria },
  descartada: { gap: 2, padding: 12, borderRadius: 12, backgroundColor: cores.alertaSuave },
  tituloDescartada: { fontSize: 14, fontWeight: "600", color: cores.texto },
  nota: { fontSize: 12, lineHeight: 17, color: cores.textoSuave },
});
