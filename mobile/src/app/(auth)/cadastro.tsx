import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErroApi } from "@/api/cliente";
import { useSessao } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { Campo } from "@/components/campo";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

type Erros = Partial<Record<"nome" | "email" | "senha" | "curso", string>>;

// Mesmas regras do backend (POST /auth/cadastro): conferir aqui evita uma ida ao servidor
function validar(nome: string, email: string, senha: string): Erros {
  const erros: Erros = {};
  if (!nome.trim()) erros.nome = "Informe seu nome.";
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) erros.email = "Informe um e-mail válido.";
  if (senha.length < 8) erros.senha = "A senha precisa ter pelo menos 8 caracteres.";
  return erros;
}

export default function Cadastro() {
  const { cadastrar } = useSessao();
  const margens = useSafeAreaInsets();
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const encontrados = validar(nome, email, senha);
    setErros(encontrados);
    setErroGeral(null);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      await cadastrar({ nome: nome.trim(), email: email.trim(), senha, curso: curso.trim() || undefined });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) {
        setErros({ email: "Este e-mail já tem conta. Volte e entre." });
      } else if (e instanceof ErroApi && e.detalhes) {
        // 400: o backend diz qual campo está errado
        setErros(Object.fromEntries(e.detalhes.map((d) => [d.campo, d.mensagem])));
      } else {
        setErroGeral(e instanceof ErroApi ? e.message : "Algo deu errado. Tente de novo.");
      }
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + 12, paddingBottom: margens.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.voltar} hitSlop={12}>
          <Icone nome="voltar" tamanho={22} cor={cores.texto} />
        </Pressable>

        <View style={{ gap: 4 }}>
          <Text style={estilos.titulo}>Criar conta</Text>
          <Text style={estilos.subtitulo}>Leva menos de um minuto.</Text>
        </View>

        <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Maria Silva" autoComplete="name" erro={erros.nome} />
        <Campo
          rotulo="Curso (opcional)"
          value={curso}
          onChangeText={setCurso}
          placeholder="Sistemas de Informação"
          erro={erros.curso}
        />
        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          erro={erros.email}
        />
        <Campo
          rotulo="Senha"
          value={senha}
          onChangeText={setSenha}
          placeholder="Mínimo de 8 caracteres"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          erro={erros.senha}
        />
        {erroGeral ? <Text style={estilos.erro}>{erroGeral}</Text> : null}
        <Botao rotulo="Criar conta" onPress={enviar} carregando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, gap: 16 },
  voltar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 26, fontWeight: "700", color: cores.texto },
  subtitulo: { fontSize: 14, color: cores.textoSuave },
  erro: { fontSize: 14, color: cores.perigo },
});
