# BUS.AI — Aplicativo mobile

Aplicativo do BUS.AI para estudantes, feito com **React Native + Expo (SDK 58) + TypeScript**.
Ele consome a API do backend descrita em [`../docs/API.md`](../docs/API.md).

## Funcionalidades

| Tela | O que faz | Rotas da API |
|---|---|---|
| Entrar / Criar conta | Login e cadastro; o token JWT fica no armazenamento seguro do celular | `POST /auth/login`, `POST /auth/cadastro`, `GET /usuarios/me` |
| Perfil | Escolha do ônibus e autorização (ou revogação) do uso da localização | `PUT /usuarios/me/linha`, `POST`/`DELETE /usuarios/me/consentimento-localizacao` |
| Horários | Aulas da semana: adicionar, editar e excluir | `/compromissos` |
| Início — recomendações | Tempo livre até o próximo compromisso e atividades que cabem nele, com justificativa; modo de simulação de dia e hora | `GET /recomendacoes` |
| Início — "Estou no ônibus" | Compartilha a localização durante a viagem (geolocalização colaborativa) | `/viagens` |
| Mapa | Posição estimada do ônibus, com círculo de incerteza | `GET /linhas/:id/posicao` |

## Como rodar

Pré-requisitos: Node.js LTS, o backend rodando (ver `../backend`) e o app **Expo Go** no celular.

Todos os comandos abaixo são executados **dentro da pasta `mobile`**.

1. Instalar as dependências:

   ```
   npm install
   ```

2. Configurar o endereço do backend. Copie o modelo e coloque o endereço do túnel (sem barra no final):

   ```
   copy .env.example .env.local
   ```

   O `.env.local` **não vai para o Git**, porque o endereço do túnel muda toda vez que ele é religado.
   O Expo só lê esse arquivo ao iniciar: depois de mudar o endereço, reinicie o `npx expo start`.

3. Iniciar e escanear o QR code com o Expo Go:

   ```
   npx expo start
   ```

   Ao iniciar, o terminal deve mostrar `env: load .env.local`. Rode apenas um Expo por vez:
   se ele perguntar se pode usar outra porta, feche o Expo que já está aberto.

4. Verificar os tipos (deve terminar sem nenhuma mensagem):

   ```
   npx tsc --noEmit
   ```

   Depois de um `git pull` que traz telas novas, rode `npx expo start` uma vez antes do `tsc`,
   para a lista de rotas tipadas ser atualizada.

## APK para Android (EAS Build)

No Android, o app também pode ser instalado como APK. Nesse modo a localização é enviada
**em segundo plano**, com a tela bloqueada, até o aluno tocar em "Desci do ônibus".
No iPhone, o app continua sendo usado pelo Expo Go, com a tela ligada.

1. Instalar as dependências da coleta em segundo plano (uma vez):

   ```
   npx expo install expo-task-manager @react-native-async-storage/async-storage
   ```

2. Entrar na conta Expo do projeto e ligar o projeto ao EAS (uma vez):

   ```
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

3. Gerar o APK na nuvem da Expo (leva alguns minutos):

   ```
   npx eas-cli@latest build -p android --profile preview
   ```

4. No fim, o terminal mostra um link e um QR code. Abra no celular Android, baixe e instale o APK
   (o Android pede para permitir a instalação de "fontes desconhecidas").

5. Na tela Entrar, toque em **"Servidor"** e cole o endereço atual do túnel. Ele fica salvo no celular;
   quando o túnel mudar, basta colar o novo, sem gerar outro APK.

Gere um APK novo só quando o **código** do app mudar.

## Organização do código

```
src/
  app/            telas (Expo Router: cada arquivo é uma rota)
    (auth)/       entrar e cadastro — só sem login
    (app)/        telas com login
      (abas)/     Início, Horários, Mapa e Perfil
  api/            chamadas ao backend e tipos das respostas
  auth/           sessão: token, login, logout automático no 401
  viagem/         compartilhamento de localização
    compartilhamento.tsx   coleta com a tela ligada (Expo Go) e estado da tela
    segundo-plano.ts       coleta em segundo plano (APK Android)
    parametros.ts          intervalo de 5 s, limite de precisão e tamanho do lote
  components/     peças visuais reutilizadas
  config.ts       endereço do backend (.env.local ou o digitado na tela Entrar)
  theme.ts        cores do protótipo
```

## Parâmetros da geolocalização colaborativa

Definidos em `src/viagem/parametros.ts`:

| Parâmetro | Valor | Observação |
|---|---|---|
| `INTERVALO_ENVIO_S` | 5 s | Intervalo do protocolo de campo; mude aqui para avaliar 10 ou 15 s |
| `PRECISAO_MAXIMA_M` | 100 m | Cópia do limite do backend (`estimativa.ts`), usado só para avisar o aluno |
| Lote máximo | 100 leituras | Limite de `POST /viagens/:id/leituras` |

Sem internet, as leituras ficam numa fila no celular e são enviadas em lote quando a conexão volta.
Cada leitura leva o horário em que o celular a mediu.

## Limitações conhecidas

- **Envio só com o app aberto no Expo Go.** No Expo Go (iPhone), a localização não é enviada em
  segundo plano; por isso a tela fica ligada durante a viagem (`expo-keep-awake`). No APK do Android,
  o envio continua com a tela bloqueada. No iPhone, isso exigiria uma conta paga da Apple.
- **Fabricantes Android** (Samsung, Xiaomi e outros) podem encerrar serviços em segundo plano para economizar
  bateria. Desligue a economia de bateria para o BUS.AI durante os testes.
- **Mapa embutido só no iPhone.** No Android, o mapa embutido exige uma chave paga do Google Maps
  (sem ela, fica em branco no Expo Go e fecha o APK), então não é exibido. O painel continua
  funcionando, e o botão "Abrir no app de mapas" mostra a posição. No iPhone (Apple Maps) o mapa funciona.
- **GPS em lugar fechado.** A precisão pode passar de 100 m; o backend descarta essas leituras
  e o mapa pode ficar sem posição. O app avisa quando isso acontece.
- **Recomendações sem a posição do celular.** A tela Início não envia a localização, para cumprir
  a promessa de usá-la só durante a viagem; o backend parte do local da última aula do dia.
