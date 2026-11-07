import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { cores } from "@/theme";

// Mesmo componente "Botão" do Figma, com as variantes Primário, Secundário e Texto
type Props = {
  rotulo: string;
  onPress: () => void;
  tipo?: "primario" | "secundario" | "texto";
  carregando?: boolean;
  desabilitado?: boolean;
};

export function Botao({ rotulo, onPress, tipo = "primario", carregando = false, desabilitado = false }: Props) {
  const corTexto = tipo === "primario" ? cores.superficie : tipo === "secundario" ? cores.texto : cores.primaria;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={desabilitado || carregando}
      style={({ pressed }) => [
        estilos.base,
        estilos[tipo],
        (desabilitado || carregando) && estilos.inativo,
        pressed && estilos.pressionado,
      ]}
    >
      {carregando ? <ActivityIndicator color={corTexto} /> : <Text style={[estilos.rotulo, { color: corTexto }]}>{rotulo}</Text>}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { minHeight: 52, borderRadius: 14, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  primario: { backgroundColor: cores.primaria },
  secundario: { backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  texto: { backgroundColor: "transparent" },
  inativo: { opacity: 0.6 },
  pressionado: { opacity: 0.85 },
  rotulo: { fontSize: 16, fontWeight: "600" },
});
