import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErroApi } from "@/api/cliente";
import { useSessao } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { Campo } from "@/components/campo";
import { CampoServidor } from "@/components/campo-servidor";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

// Tela "01 · Entrar" do protótipo no Figma
export default function Entrar() {
  const { entrar } = useSessao();
  const margens = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      // Deu certo: o layout raiz percebe o usuário logado e abre as abas sozinho
      await entrar(email.trim(), senha);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Algo deu errado. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[estilos.topo, { paddingTop: margens.top + 48 }]}>
          <View style={estilos.logo}>
            <Icone nome="onibus" tamanho={32} cor={cores.superficie} />
          </View>
          <Text style={estilos.marca}>BUS.AI</Text>
          <Text style={estilos.slogan}>Seu ônibus e seu tempo livre,{"\n"}sem complicação.</Text>
        </View>

        <View style={[estilos.cartao, { paddingBottom: margens.bottom + 24 }]}>
          <View style={{ gap: 4 }}>
            <Text style={estilos.titulo}>Entrar</Text>
            <Text style={estilos.subtitulo}>Use o e-mail que você cadastrou.</Text>
          </View>
          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            placeholder="Sua senha"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={enviar}
          />
          {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
          <Botao rotulo="Entrar" onPress={enviar} carregando={enviando} />
          <View style={estilos.rodape}>
            <Text style={estilos.subtitulo}>Não tem conta?</Text>
            <Link href="/cadastro" style={estilos.link}>
              Criar conta
            </Link>
          </View>
          {/* Endereço do backend: no APK do Android, é aqui que se cola o endereço novo do túnel */}
          <CampoServidor />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.marinho },
  topo: { alignItems: "center", gap: 14, paddingBottom: 72, paddingHorizontal: 20 },
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: cores.primaria, alignItems: "center", justifyContent: "center" },
  marca: { fontSize: 28, fontWeight: "700", color: cores.superficie, letterSpacing: 0.5 },
  slogan: { fontSize: 15, lineHeight: 22, color: cores.superficie, opacity: 0.75, textAlign: "center" },
  cartao: {
    flexGrow: 1,
    marginTop: -40,
    backgroundColor: cores.fundo,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 20,
    gap: 16,
  },
  titulo: { fontSize: 24, fontWeight: "700", color: cores.texto },
  subtitulo: { fontSize: 14, color: cores.textoSuave },
  erro: { fontSize: 14, color: cores.perigo },
  rodape: { flexDirection: "row", justifyContent: "center", gap: 4 },
  link: { fontSize: 14, fontWeight: "600", color: cores.primaria },
});
