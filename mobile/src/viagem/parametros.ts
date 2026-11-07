// Parâmetros da coleta de localização, usados com a tela ligada (Expo Go) e em segundo plano (APK Android)

// Intervalo de envio definido no protocolo do teste de campo (docs/protocolo-teste-campo.md).
// É um dos parâmetros avaliados no TCC: para testar 10 ou 15 s, mude aqui.
export const INTERVALO_ENVIO_S = 5;
export const INTERVALO_MS = INTERVALO_ENVIO_S * 1000;

// Mesmo valor de PRECISAO_MAXIMA_M em backend/src/geolocalizacao/estimativa.ts:
// leituras com precisão pior que isso são ignoradas pelo servidor. Se mudar lá, mude aqui.
export const PRECISAO_MAXIMA_M = 100;

export const MAX_POR_LOTE = 100; // limite de POST /viagens/:id/leituras

// Uma posição medida pelo GPS, já no formato que a API espera
export type Leitura = {
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  registradaEm: number; // milissegundos, horário em que o CELULAR mediu
};
