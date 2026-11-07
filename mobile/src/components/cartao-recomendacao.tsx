import { StyleSheet, Text, View } from "react-native";
import { nomeCategoria, type Recomendacao } from "@/api/recomendacoes";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

// Um cartão por atividade sugerida. A justificativa vem pronta do backend e mostra
// POR QUE a atividade cabe no intervalo: é isso que torna a recomendação explicável.
type Props = { item: Recomendacao; destaque?: boolean };

export function CartaoRecomendacao({ item, destaque = false }: Props) {
  return (
    <View
      style={[estilos.cartao, destaque && estilos.destaque]}
      accessible
      accessibilityLabel={`${item.titulo}, em ${item.local}. ${item.justificativa}`}
    >
      <View style={estilos.topo}>
        <View style={estilos.categoria}>
          <Text style={estilos.textoCategoria}>{(nomeCategoria[item.categoria] ?? item.categoria).toUpperCase()}</Text>
        </View>
        {destaque ? <Text style={estilos.melhor}>Melhor opção</Text> : null}
        <Text style={estilos.pontuacao}>{item.pontuacao} pts</Text>
      </View>

      <Text style={estilos.titulo}>{item.titulo}</Text>
      <View style={estilos.local}>
        <Icone nome="localizacao" tamanho={14} cor={cores.textoSuave} />
        <Text style={estilos.suave}>{item.local}</Text>
      </View>

      <View style={estilos.tempos}>
        <Tempo rotulo="Ida" minutos={item.idaMin} />
        <Tempo rotulo="Total" minutos={item.totalMin} />
        <Tempo rotulo="Sobram" minutos={item.folgaMin} />
      </View>

      <Text style={estilos.justificativa}>{item.justificativa}</Text>
    </View>
  );
}

function Tempo({ rotulo, minutos }: { rotulo: string; minutos: number }) {
  return (
    <View style={estilos.tempo}>
      <Text style={estilos.valorTempo}>{minutos} min</Text>
      <Text style={estilos.suave}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  destaque: { borderColor: cores.primaria, borderWidth: 2 },
  topo: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoria: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: cores.primariaSuave },
  textoCategoria: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, color: cores.primaria },
  melhor: { fontSize: 12, fontWeight: "600", color: cores.sucesso },
  pontuacao: { marginLeft: "auto", fontSize: 13, fontWeight: "700", color: cores.texto },
  titulo: { fontSize: 17, fontWeight: "600", color: cores.texto },
  local: { flexDirection: "row", alignItems: "center", gap: 6 },
  suave: { fontSize: 12, color: cores.textoSuave },
  tempos: { flexDirection: "row", gap: 8 },
  tempo: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: cores.fundo },
  valorTempo: { fontSize: 15, fontWeight: "700", color: cores.texto },
  justificativa: { fontSize: 13, lineHeight: 18, color: cores.textoSuave },
});
