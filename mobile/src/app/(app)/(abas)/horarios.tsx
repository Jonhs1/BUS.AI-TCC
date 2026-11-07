import { Fragment, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { diasCurtos, diasLongos, LOCAL_UEMG_ID, paraMinutos, useCompromissos } from "@/api/compromissos";
import { Botao } from "@/components/botao";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

// Segunda a sábado; domingo só aparece se o aluno tiver algo nesse dia
const diasDaSemana = [1, 2, 3, 4, 5, 6];

function diaInicial() {
  const hoje = new Date().getDay();
  return hoje === 0 ? 1 : hoje;
}

// Tela "04 · Meus horários" do Figma
export default function Horarios() {
  const { compromissos, carregando, erro, recarregar } = useCompromissos();
  const margens = useSafeAreaInsets();
  const [dia, setDia] = useState(diaInicial);
  const [atualizando, setAtualizando] = useState(false);

  const dias = compromissos.some((c) => c.diaSemana === 0) ? [...diasDaSemana, 0] : diasDaSemana;
  // Já vêm ordenados por dia e horário do backend
  const doDia = compromissos.filter((c) => c.diaSemana === dia);

  async function puxarParaAtualizar() {
    setAtualizando(true);
    await recarregar();
    setAtualizando(false);
  }

  return (
    <View style={estilos.tela}>
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + 16 }]}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={puxarParaAtualizar} tintColor={cores.primaria} />}
      >
        <View style={{ gap: 4 }}>
          <Text style={estilos.titulo}>Meus horários</Text>
          <Text style={estilos.subtitulo}>Suas aulas se repetem toda semana.</Text>
        </View>

        <View style={estilos.dias}>
          {dias.map((d) => {
            const ativo = d === dia;
            const total = compromissos.filter((c) => c.diaSemana === d).length;
            return (
              <Pressable
                key={d}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={`${diasLongos[d]}, ${total} compromisso(s)`}
                onPress={() => setDia(d)}
                style={[estilos.dia, ativo && estilos.diaAtivo]}
              >
                <Text style={[estilos.diaNome, ativo && { color: cores.superficie }]}>{diasCurtos[d]}</Text>
                <Text style={[estilos.diaTotal, ativo && { color: cores.superficie, opacity: 0.85 }]}>{total || "—"}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={estilos.cabecalhoDia}>
          <View style={{ gap: 2 }}>
            <Text style={estilos.nomeDia}>{diasLongos[dia]}</Text>
            {doDia.length > 0 ? (
              <Text style={estilos.subtitulo}>
                {doDia[0].inicio} – {doDia[doDia.length - 1].fim}
              </Text>
            ) : null}
          </View>
          {/* Fica no conteúdo, e não flutuando no rodapé, para nunca ficar atrás da barra de abas */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Adicionar horário na ${diasLongos[dia].toLowerCase()}`}
            onPress={() => router.push({ pathname: "/aula", params: { dia: String(dia) } })}
            style={({ pressed }) => [estilos.adicionar, pressed && { opacity: 0.85 }]}
          >
            <Icone nome="mais" tamanho={16} cor={cores.superficie} />
            <Text style={estilos.textoAdicionar}>Adicionar</Text>
          </Pressable>
        </View>

        {carregando ? (
          <ActivityIndicator color={cores.primaria} style={{ marginTop: 24 }} />
        ) : erro ? (
          <View style={{ gap: 12 }}>
            <Text style={estilos.erro}>{erro}</Text>
            <Botao tipo="secundario" rotulo="Tentar de novo" onPress={recarregar} />
          </View>
        ) : doDia.length === 0 ? (
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTitulo}>Nada na {diasLongos[dia].toLowerCase()}</Text>
            <Text style={estilos.subtitulo}>Toque em “Adicionar” para cadastrar uma aula.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {doDia.map((c, i) => {
              // Intervalo livre entre o fim desta aula e o início da anterior
              const livre = i > 0 ? paraMinutos(c.inicio) - paraMinutos(doDia[i - 1].fim) : 0;
              return (
                <Fragment key={c.id}>
                  {livre > 0 ? (
                    <View style={estilos.intervalo}>
                      <Icone nome="brilho" tamanho={13} cor={cores.primaria} />
                      <Text style={estilos.textoIntervalo}>{livre} min livres</Text>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${c.titulo}, das ${c.inicio} às ${c.fim}. Toque para editar.`}
                    onPress={() => router.push({ pathname: "/aula", params: { id: String(c.id) } })}
                    style={({ pressed }) => [estilos.linha, pressed && { opacity: 0.8 }]}
                  >
                    <View style={estilos.horario}>
                      <Text style={estilos.inicio}>{c.inicio}</Text>
                      <Text style={estilos.fim}>{c.fim}</Text>
                    </View>
                    <View style={estilos.cartao}>
                      <View style={estilos.tipo}>
                        <Text style={estilos.textoTipo}>{c.tipo === "AULA" ? "AULA" : "OUTRO"}</Text>
                      </View>
                      <Text style={estilos.tituloAula}>{c.titulo}</Text>
                      {c.localId === LOCAL_UEMG_ID ? (
                        <View style={estilos.local}>
                          <Icone nome="localizacao" tamanho={14} cor={cores.textoSuave} />
                          <Text style={estilos.subtitulo}>UEMG Unidade 5</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  titulo: { fontSize: 26, fontWeight: "700", color: cores.texto },
  subtitulo: { fontSize: 13, color: cores.textoSuave },
  dias: { flexDirection: "row", gap: 6 },
  dia: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  diaAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  diaNome: { fontSize: 14, fontWeight: "600", color: cores.texto },
  diaTotal: { fontSize: 11, fontWeight: "500", color: cores.textoSuave },
  cabecalhoDia: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nomeDia: { fontSize: 16, fontWeight: "700", color: cores.texto },
  erro: { fontSize: 14, color: cores.perigo },
  vazio: { padding: 20, gap: 6, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: cores.borda },
  vazioTitulo: { fontSize: 15, fontWeight: "600", color: cores.texto },
  intervalo: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginLeft: 60,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: cores.primariaSuave,
  },
  textoIntervalo: { fontSize: 12, fontWeight: "600", color: cores.primaria },
  linha: { flexDirection: "row", gap: 12 },
  horario: { width: 48, paddingTop: 16, gap: 2 },
  inicio: { fontSize: 15, fontWeight: "700", color: cores.texto },
  fim: { fontSize: 12, color: cores.textoSuave },
  cartao: {
    flex: 1,
    gap: 6,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  tipo: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: cores.primariaSuave },
  textoTipo: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, color: cores.primaria },
  tituloAula: { fontSize: 16, fontWeight: "600", color: cores.texto },
  local: { flexDirection: "row", alignItems: "center", gap: 6 },
  adicionar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: cores.primaria,
  },
  textoAdicionar: { fontSize: 14, fontWeight: "600", color: cores.superficie },
});
