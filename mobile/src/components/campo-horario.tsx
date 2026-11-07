import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import { cores } from "@/theme";

// Campo de horário "HH:MM" com o seletor nativo do celular.
// iPhone: o seletor compacto aparece direto no campo. Android: abre uma janela ao tocar.
type Props = { rotulo: string; valor: string; onChange: (hora: string) => void; erro?: string };

function paraData(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const data = new Date();
  data.setHours(h, m, 0, 0);
  return data;
}

function paraHora(data: Date) {
  return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

export function CampoHorario({ rotulo, valor, onChange, erro }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      {Platform.OS === "ios" ? (
        <View style={[estilos.caixa, erro ? estilos.caixaErro : null]}>
          <Text style={estilos.ajuda}>Toque para mudar</Text>
          <DateTimePicker
            value={paraData(valor)}
            mode="time"
            display="compact"
            locale="pt_BR"
            accentColor={cores.primaria}
            onValueChange={(_, data) => onChange(paraHora(data))}
          />
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${rotulo}: ${valor}`}
            onPress={() => setAberto(true)}
            style={[estilos.caixa, erro ? estilos.caixaErro : null]}
          >
            <Text style={estilos.valor}>{valor}</Text>
            <Text style={estilos.ajuda}>Alterar</Text>
          </Pressable>
          {/* No Android o seletor é uma janela: monta ao tocar e desmonta ao confirmar ou cancelar */}
          {aberto ? (
            <DateTimePicker
              value={paraData(valor)}
              mode="time"
              is24Hour
              accentColor={cores.primaria}
              onValueChange={(_, data) => {
                setAberto(false);
                onChange(paraHora(data));
              }}
              onDismiss={() => setAberto(false)}
            />
          ) : null}
        </>
      )}
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, gap: 6 },
  rotulo: { fontSize: 13, fontWeight: "500", color: cores.textoSuave },
  caixa: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  caixaErro: { borderColor: cores.perigo },
  valor: { fontSize: 17, fontWeight: "600", color: cores.texto },
  ajuda: { fontSize: 12, color: cores.textoSuave },
  erro: { fontSize: 12, color: cores.perigo },
});
