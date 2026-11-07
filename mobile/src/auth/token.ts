// O token fica no armazenamento seguro do celular (Keychain no iPhone, Keystore no Android).
// Em arquivo próprio porque a tarefa em segundo plano também precisa dele.
export const CHAVE_TOKEN = "busai.token";
