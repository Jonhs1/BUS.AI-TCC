import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErroApi } from "@/api/cliente";
import { useLinhas } from "@/api/linhas";
import { useSessao } from "@/auth/sessao";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

// Tela "07 · Perfil" do Figma
export default function Perfil() {
  const { usuario, sair, api, atualizarUsuario } = useSessao();
  const { linhas } = useLinhas();
  const margens = useSafeAreaInsets();
  const [revogando, setRevogando] = useState(false);
  if (!usuario) return null;

  const iniciais = usuario.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
  const linha = linhas.find((l) => l.id === usuario.linhaId);
  const autorizada = usuario.consentiuLocalizacaoEm !== null;

  function alternarLocalizacao(ligar: boolean) {
    if (ligar) {
      router.push("/permitir-localizacao");
      return;
    }
    Alert.alert("Parar de compartilhar?", "Seu celular deixa de ajudar a mostrar o ônibus. Dá para ligar de novo quando quiser.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Parar", style: "destructive", onPress: revogar },
    ]);
  }

  async function revogar() {
    if (!usuario) return;
    setRevogando(true);
    try {
      // 204 sem corpo: o backend também encerra na hora qualquer viagem em andamento
      await api("/usuarios/me/consentimento-localizacao", { metodo: "DELETE" });
      atualizarUsuario({ ...usuario, consentiuLocalizacaoEm: null });
    } catch (e) {
      Alert.alert("Não deu certo", e instanceof ErroApi ? e.message : "Tente de novo.");
    } finally {
      setRevogando(false);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + 16 }]}>
      <Text style={estilos.titulo}>Perfil</Text>

      <View style={[estilos.cartao, estilos.aluno]}>
        <View style={estilos.avatar}>
          <Text style={estilos.iniciais}>{iniciais}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={estilos.nome}>{usuario.nome}</Text>
          {usuario.curso ? <Text style={estilos.info}>{usuario.curso}</Text> : null}
          <Text style={estilos.info}>{usuario.email}</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={estilos.grupo}>TRANSPORTE</Text>
        <View style={estilos.cartao}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/escolher-onibus")}
            style={({ pressed }) => [estilos.linha, pressed && { opacity: 0.7 }]}
          >
            <View style={estilos.iconeLinha}>
              <Icone nome="onibus" tamanho={18} cor={cores.primaria} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={estilos.tituloLinha}>Meu ônibus</Text>
              <Text style={estilos.info}>{linha ? linha.nome : usuario.linhaId ? "Carregando…" : "Toque para escolher"}</Text>
            </View>
            <Icone nome="seta" tamanho={18} cor={cores.textoSuave} />
          </Pressable>

          <View style={estilos.divisor} />

          <View style={estilos.linha}>
            <View style={estilos.iconeLinha}>
              <Icone nome="localizacao" tamanho={18} cor={cores.primaria} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={estilos.tituloLinha}>Compartilhar localização</Text>
              <Text style={estilos.info}>
                {autorizada
                  ? `Autorizado em ${new Date(usuario.consentiuLocalizacaoEm!).toLocaleDateString("pt-BR")}`
                  : "Desligado"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Compartilhar localização"
              value={autorizada}
              disabled={revogando}
              onValueChange={alternarLocalizacao}
              trackColor={{ true: cores.sucesso, false: cores.borda }}
              thumbColor={cores.superficie}
            />
          </View>
        </View>
      </View>

      {/* Ao sair, o token é apagado e o app volta sozinho para "Entrar" */}
      <Pressable
        accessibilityRole="button"
        onPress={sair}
        style={({ pressed }) => [estilos.cartao, estilos.sair, pressed && { opacity: 0.7 }]}
      >
        <Icone nome="sair" tamanho={18} cor={cores.perigo} />
        <Text style={estilos.textoSair}>Sair da conta</Text>
      </Pressable>

      <Text style={estilos.rodape}>BUS.AI · TCC Sistemas de Informação · UEMG Passos</Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  titulo: { fontSize: 26, fontWeight: "700", color: cores.texto },
  cartao: { borderRadius: 18, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  aluno: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 20 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  iniciais: { fontSize: 18, fontWeight: "600", color: cores.primaria },
  nome: { fontSize: 17, fontWeight: "600", color: cores.texto },
  info: { fontSize: 13, color: cores.textoSuave },
  grupo: { fontSize: 12, fontWeight: "600", letterSpacing: 0.7, color: cores.textoSuave },
  linha: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  iconeLinha: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: cores.fundo,
    alignItems: "center",
    justifyContent: "center",
  },
  tituloLinha: { fontSize: 15, fontWeight: "600", color: cores.texto },
  divisor: { height: 1, backgroundColor: cores.borda },
  sair: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  textoSair: { fontSize: 15, fontWeight: "600", color: cores.perigo },
  rodape: { fontSize: 12, color: cores.textoSuave, textAlign: "center" },
});
