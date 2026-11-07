import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { cores } from "@/theme";

// Mesmo componente "Campo" do Figma: rótulo em cima, caixa de texto e mensagem de erro opcional
type Props = TextInputProps & { rotulo: string; erro?: string };

export function Campo({ rotulo, erro, style, ...props }: Props) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        placeholderTextColor={cores.textoSuave}
        style={[estilos.caixa, erro ? estilos.caixaErro : null, style]}
        accessibilityLabel={rotulo}
        {...props}
      />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: 6 },
  rotulo: { fontSize: 13, fontWeight: "500", color: cores.textoSuave },
  caixa: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    paddingHorizontal: 16,
    fontSize: 15,
    color: cores.texto,
  },
  caixaErro: { borderColor: cores.perigo },
  erro: { fontSize: 12, color: cores.perigo },
});
