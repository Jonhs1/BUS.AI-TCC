// Uma leitura fora do período não deve eliminar as outras do mesmo lote.
// Também impede que leituras medidas depois do limite máximo da viagem sejam aceitas.
export const DURACAO_MAXIMA_VIAGEM_MIN = 180;
export const TOLERANCIA_RELOGIO_MS = 2 * 60_000;

export function separarLeiturasPorPeriodo<T extends { registradaEm: Date }>(
  leituras: T[],
  inicioViagemMs: number,
  agoraMs: number,
): { validas: T[]; descartadas: number } {
  const inicio = inicioViagemMs - TOLERANCIA_RELOGIO_MS;
  const fim = Math.min(agoraMs + TOLERANCIA_RELOGIO_MS, inicioViagemMs + DURACAO_MAXIMA_VIAGEM_MIN * 60_000);
  const validas = leituras.filter((l) => {
    const tempo = l.registradaEm.getTime();
    return Number.isFinite(tempo) && tempo >= inicio && tempo <= fim;
  });
  return { validas, descartadas: leituras.length - validas.length };
}
