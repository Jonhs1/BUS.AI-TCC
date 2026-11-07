import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

// Tela provisória das abas: título de verdade + aviso de qual etapa vai preenchê-la
type Props = { titulo: string; subtitulo?: string; aviso: string; children?: ReactNode };

export function EmBreve({ titulo, subtitulo, aviso, children }: Props) {
  const margens = useSafeAreaInsets();
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + 16 }]}>
      <View style={{ gap: 4 }}>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>
      {children}
      <View style={estilos.aviso}>
        <Icone nome="construcao" tamanho={20} cor={cores.primaria} />
        <Text style={estilos.textoAviso}>{aviso}</Text>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  subtitulo: { fontSize: 13, fontWeight: "500", color: cores.textoSuave },
  titulo: { fontSize: 26, fontWeight: "700", color: cores.texto },
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: cores.primariaSuave,
  },
  textoAviso: { flex: 1, fontSize: 14, lineHeight: 20, color: cores.primaria },
});
