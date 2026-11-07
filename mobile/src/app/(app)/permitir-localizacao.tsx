import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErroApi } from "@/api/cliente";
import { useSessao, type Usuario } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { Icone, type NomeIcone } from "@/components/icone";
import { cores } from "@/theme";
import { MODO_SEGUNDO_PLANO } from "@/viagem/segundo-plano";

// Tela "02 · Permitir localização" do Figma. A API pede que o app explique o uso antes
// de registrar o consentimento (POST /usuarios/me/consentimento-localizacao).
const garantias: { icone: NomeIcone; titulo: string; texto: string }[] = [
  {
    icone: "onibus",
    titulo: "Só durante a viagem",
    // No APK do Android a coleta continua com a tela bloqueada: o aluno precisa saber disso ao autorizar
    texto: MODO_SEGUNDO_PLANO
      ? "Liga quando você toca em “Estou no ônibus” e desliga em “Desci”, mesmo com a tela bloqueada. Uma notificação fica visível enquanto isso."
      : "Liga quando você toca em “Estou no ônibus” e desliga em “Desci”.",
  },
  { icone: "pessoas", titulo: "Ninguém vê você", texto: "O mapa mostra só a posição estimada do ônibus, nunca a sua." },
  { icone: "ligar", titulo: "Você decide", texto: "Desligue quando quiser, na tela de Perfil." },
];

export default function PermitirLocalizacao() {
  const { api, atualizarUsuario } = useSessao();
  const margens = useSafeAreaInsets();
  const [enviando, setEnviando] = useState(false);
  // "bloqueada" = o aluno negou e o celular não deixa perguntar de novo; só nas Configurações
  const [negada, setNegada] = useState<"negada" | "bloqueada" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function permitir() {
    setEnviando(true);
    setErro(null);
    try {
      // 1. Pergunta ao celular (janela do sistema)
      const permissao = await Location.requestForegroundPermissionsAsync();
      if (!permissao.granted) {
        setNegada(permissao.canAskAgain ? "negada" : "bloqueada");
        return;
      }
      // 2. Registra no backend que o aluno concordou
      const resposta = await api<{ usuario: Usuario }>("/usuarios/me/consentimento-localizacao", { metodo: "POST" });
      atualizarUsuario(resposta.usuario);
      router.back();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={[estilos.tela, { paddingTop: margens.top + 32, paddingBottom: margens.bottom + 16 }]}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={estilos.ilustracao}>
          <View style={estilos.halo}>
            <View style={estilos.circulo}>
              <Icone nome="escudo" tamanho={34} cor={cores.superficie} />
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={estilos.titulo}>Ajude a mostrar onde o ônibus está</Text>
          <Text style={estilos.texto}>
            Quando você está no ônibus, sua localização ajuda o app a estimar a posição dele para todos os colegas.
          </Text>
        </View>

        <View style={{ gap: 18 }}>
          {garantias.map((g) => (
            <View key={g.titulo} style={estilos.garantia}>
              <View style={estilos.iconeGarantia}>
                <Icone nome={g.icone} tamanho={20} cor={cores.primaria} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={estilos.tituloGarantia}>{g.titulo}</Text>
                <Text style={estilos.textoGarantia}>{g.texto}</Text>
              </View>
            </View>
          ))}
        </View>

        {negada ? (
          <View style={estilos.aviso}>
            <Text style={estilos.textoAviso}>
              {negada === "bloqueada"
                ? "A localização está bloqueada para o app. Libere em Configurações > BUS.AI > Localização."
                : "Sem a permissão do celular não dá para compartilhar. Você pode tentar de novo quando quiser."}
            </Text>
          </View>
        ) : null}
        {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
      </ScrollView>

      <View style={estilos.acoes}>
        {negada === "bloqueada" ? (
          <Botao rotulo="Abrir configurações" onPress={() => Linking.openSettings()} />
        ) : (
          <Botao rotulo="Permitir localização" onPress={permitir} carregando={enviando} />
        )}
        <Botao tipo="texto" rotulo="Agora não" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, gap: 24 },
  ilustracao: { alignItems: "center" },
  halo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  circulo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: cores.primaria,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 26, lineHeight: 32, fontWeight: "700", color: cores.texto },
  texto: { fontSize: 15, lineHeight: 22, color: cores.textoSuave },
  garantia: { flexDirection: "row", gap: 14 },
  iconeGarantia: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  tituloGarantia: { fontSize: 15, fontWeight: "600", color: cores.texto },
  textoGarantia: { fontSize: 13, lineHeight: 19, color: cores.textoSuave },
  aviso: { padding: 14, borderRadius: 14, backgroundColor: cores.alertaSuave },
  textoAviso: { fontSize: 13, lineHeight: 19, color: cores.texto },
  erro: { fontSize: 14, color: cores.perigo },
  acoes: { paddingHorizontal: 20, paddingTop: 12, gap: 4 },
});
