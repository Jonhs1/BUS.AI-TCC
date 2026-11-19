// Limite de privacidade compartilhado pelos dois modos de coleta.
// O backend também possui proteção própria de 180 minutos.
export const DURACAO_MAXIMA_COLETA_MS = 180 * 60_000;
export function coletaExpirou(inicioMs: number, agoraMs: number = Date.now()) {
  return Number.isFinite(inicioMs) && agoraMs - inicioMs >= DURACAO_MAXIMA_COLETA_MS;
}
