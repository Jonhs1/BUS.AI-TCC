<div align="center">

# 🚌 BUS.AI

### Mobilidade universitária, aproveitamento do tempo e apoio aos estudos

Aplicativo de apoio à rotina de estudantes que se deslocam para a universidade em transporte coletivo, com **recomendações de atividades**, **geolocalização colaborativa dos ônibus** e **assistente com inteligência artificial**.

![Expo](https://img.shields.io/badge/Expo-SDK%2058-111827?logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.88-087EA4?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%20%2B%20Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL%20%2B%20Prisma-4169E1?logo=postgresql&logoColor=white)

**Trabalho de Conclusão de Curso · Sistemas de Informação · UEMG — Unidade Passos**

[Problema e solução](#-problema-e-solução) · [Funcionalidades](#-funcionalidades) · [Arquitetura](#-arquitetura) · [Executar](#-como-executar) · [Testes](#-testes-e-avaliação) · [Limitações](#-limitações-conhecidas)

</div>

---

## 🎯 Problema e solução

Parte dos estudantes da UEMG Passos se desloca de outras cidades e depende de ônibus de prefeituras ou empresas. Além da incerteza sobre a localização do transporte, esses estudantes precisam organizar os intervalos entre compromissos acadêmicos.

O **BUS.AI** reúne três funcionalidades complementares:

1. **Organização da rotina:** cadastro de aulas e compromissos, com identificação do tempo livre.
2. **Mobilidade colaborativa:** estimativa da posição de uma linha a partir dos celulares de estudantes que autorizaram a coleta e iniciaram uma viagem.
3. **Apoio inteligente:** sugestões de atividades calculadas por um **motor de regras** e explicações ou apoio ao estudo por meio do **Google Gemini**.

> O BUS.AI é um protótipo acadêmico. Não possui rastreador instalado nos ônibus nem integração com GPS de operadoras. A estimativa depende de estudantes compartilhando localização durante a viagem.

## 📱 Funcionalidades

| Funcionalidade | Implementação atual |
|---|---|
| **Cadastro, login e perfil** | Contas com senha protegida por hash; autenticação JWT; seleção da linha; consentimento e revogação de localização. |
| **Horários acadêmicos** | Cadastro, consulta, edição e exclusão de compromissos semanais, com prevenção de conflitos. |
| **Recomendações de atividades** | Cálculo da janela livre, estimativa de caminhada, verificação de duração/horário de funcionamento, ordenação e justificativa das sugestões. |
| **Simulação de horários** | Possibilidade de consultar recomendações como se fosse outro dia e horário, útil para demonstração e testes. |
| **“Estou no ônibus” / “Desci”** | Início e encerramento de viagens e compartilhamento voluntário da posição do smartphone. |
| **Envio com conexão instável** | Fila local de leituras para retransmissão; lotes de até 100 amostras e contagem de leituras descartadas fora do período. |
| **Posição estimada do ônibus** | Consolidação das leituras recentes por linha, filtragem de GPS impreciso, remoção de pontos divergentes e indicador aproximado de incerteza. |
| **Mapa e acompanhamento** | Mapa integrado no iOS; no Android, painel de localização e opção de abrir a posição em aplicativo externo de mapas. |
| **Assistente IA — Decidir** | Consulta ao Gemini com contexto dos compromissos e atividades **previamente validadas pelo motor de regras**. |
| **Assistente IA — Estudar** | Explicações, resumos e questões de revisão a partir da pergunta e, opcionalmente, de material textual fornecido pelo estudante. |

O assistente é **opcional**: cadastro, horários, recomendações e rastreamento continuam disponíveis mesmo com a IA desabilitada.

### Privacidade e segurança

- A coleta de GPS exige **autorização explícita** e o início de uma viagem.
- O usuário pode revogar o consentimento; nesse caso, o backend encerra suas viagens abertas.
- O endpoint do mapa devolve **uma posição estimada combinada**, não uma lista de coordenadas individuais.
- O backend rejeita envios para viagens encerradas ou vencidas e utiliza expiração de **180 minutos**.
- O aplicativo interrompe a coleta local ao detectar esse limite (na próxima execução da tarefa ou verificação da tela; não é um cronômetro garantido quando o sistema operacional suspende a execução).
- Tokens são guardados no **Expo SecureStore**; a API usa JWT, validações Zod e limites locais de tentativas de cadastro/login.
- A chave do Gemini fica **somente no backend**. O aplicativo informa que perguntas e textos enviados ao assistente são encaminhados ao provedor de IA.

## 🧠 Como as recomendações funcionam

O recomendador principal é **determinístico e baseado em regras**, não um modelo de aprendizado de máquina.

1. Busca compromissos do dia e calcula a janela até o próximo compromisso.
2. Seleciona atividades cadastradas e estima o percurso a pé até o local e depois até o próximo compromisso.
3. Soma **ida + duração da atividade + volta + margem de 5 minutos**.
4. Descarta atividades que não cabem ou que estariam fora do horário cadastrado.
5. Pontua as atividades viáveis: **60% aproveitamento da janela** + **40% proximidade**, e apresenta uma justificativa.

Os tempos de caminhada são **estimativas** baseadas na distância de Haversine, fator de rota de 1,3 e velocidade presumida de 80 m/min — não constituem navegação por ruas em tempo real.

```mermaid
flowchart LR
    A[Horários e atividades] --> B[Calcular janela livre]
    B --> C[Somar deslocamentos e duração]
    C --> D{Cabe e está aberto?}
    D -->|Sim| E[Pontuar e justificar]
    D -->|Não| F[Informar descarte]
    E --> G[Exibir recomendações]
```

**Exemplo:** com 90 minutos livres, uma atividade de 45 minutos, deslocamentos estimados de 1 minuto para ida e 1 para volta e margem de 5 minutos consome 52 minutos; sobram 38.

Código: [`backend/src/recomendacao/motor.ts`](backend/src/recomendacao/motor.ts).

## 📍 Como a geolocalização colaborativa funciona

O BUS.AI não rastreia um ônibus diretamente: ele **estima a posição da linha** a partir das leituras GPS de participantes com viagem ativa.

```mermaid
flowchart TD
    A[Celulares em viagem ativa] --> B[Envio das coordenadas e horário da medição]
    B --> C[API registra no PostgreSQL]
    C --> D[Últimos 60 segundos]
    D --> E[Filtra precisão acima de 100 m]
    E --> F[Escolhe leitura válida mais recente por participante]
    F --> G[Trata divergências e outliers]
    G --> H[Média ponderada pela precisão]
    H --> I[Posição estimada e incerteza aproximada]
```

**Parâmetros do protótipo:**

| Parâmetro | Valor |
|---|---:|
| Intervalo configurado de coleta/envio | 5 s |
| Janela de leituras consideradas | 60 s |
| Precisão máxima aceita na estimativa | 100 m |
| Limiar de divergência/outlier | 150 m |
| Precisão assumida quando ausente | 50 m |
| Duração máxima de viagem | 180 min |
| Tamanho máximo de lote recebido | 100 leituras |

Com três ou mais aparelhos, o algoritmo usa a mediana geográfica aproximada como referência para eliminar outliers. Com dois aparelhos muito divergentes, privilegia a medição com melhor precisão declarada. Por fim, calcula uma **média ponderada pelo inverso do quadrado da precisão**; o raio reportado é uma aproximação matemática e **não uma garantia de erro real**.

No **APK Android**, o sistema utiliza `expo-location` e `expo-task-manager` para coleta em segundo plano com serviço de localização e notificação. No **Expo Go**, a coleta depende do aplicativo aberto. Em caso de falta de conexão, as medições são enfileiradas; ao retomar, o backend conserva as amostras válidas e informa quantas amostras fora do período foram descartadas.

Código: [`estimativa.ts`](backend/src/geolocalizacao/estimativa.ts), [`viagem.routes.ts`](backend/src/routes/viagem.routes.ts), [`segundo-plano.ts`](mobile/src/viagem/segundo-plano.ts).

## ✨ Assistente com Gemini

Há dois modos na aba **Assistente**:

| Modo | Objetivo | Dados utilizados |
|---|---|---|
| **Decidir** | Ajudar a organizar o intervalo até a próxima aula | Pergunta do usuário, compromissos do dia e atividades viáveis calculadas pelo motor de regras. |
| **Estudar** | Explicar temas, resumir material e propor exercícios | Pergunta do usuário e texto opcional (até 6.000 caracteres). |

A API chama o modelo `gemini-2.5-flash` a partir do **servidor**. O modelo produz a resposta textual; **não decide sozinho a viabilidade** das atividades. O aplicativo apresenta aviso de que a IA pode errar e não mantém histórico de conversas no banco.

**Controle local conservador:** 20 consultas/dia no total, 6 por usuário/dia, 3 por usuário/15 min e no máximo 2 simultâneas. O controle é persistido em arquivo local e foi projetado para **uma instância do backend**. A equipe precisa confirmar que a chave pertence a um projeto gratuito sem faturamento habilitado: as cotas internas **não garantem custo zero** caso o provedor seja configurado para cobrança.

Detalhes: [`docs/assistente-ia-limites.md`](docs/assistente-ia-limites.md).

## 🧱 Arquitetura

```mermaid
flowchart LR
    M[App React Native / Expo] -->|HTTPS, JSON, JWT| T[Túnel Cloudflare opcional]
    T --> API[API Node.js + Express]
    M -->|Rede local, em desenvolvimento| API
    API -->|Prisma ORM| DB[(PostgreSQL)]
    API -->|API REST, se habilitado| IA[Google Gemini]
```

| Camada | Tecnologias principais | Responsabilidades |
|---|---|---|
| **Mobile** | React Native 0.88, Expo SDK 58, Expo Router, TypeScript | Telas, sessão, integração com API, interface, GPS e fila local. |
| **API** | Node.js, Express 5, TypeScript, Zod | Endpoints, validação, autenticação, regras de negócio e integração Gemini. |
| **Persistência** | PostgreSQL, Prisma ORM | Usuários, compromissos, linhas, viagens, posições, locais e atividades. |
| **Autenticação** | JWT, bcryptjs, Expo SecureStore | Sessão autenticada, hash de senha e guarda do token no celular. |
| **Coleta de localização** | Expo Location, Expo Task Manager, AsyncStorage | Medições GPS, coleta em segundo plano no APK Android e fila de envio. |
| **Distribuição Android** | EAS Build | Geração de APK instalável com perfil `preview`. |
| **Testes** | `node:test`, `tsx`, TypeScript | Testes unitários e análise estática de tipos. |

### Organização do repositório

```text
BUS.AI-TCC/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # Modelagem relacional
│   │   ├── migrations/          # Migrações
│   │   └── seed.ts              # Locais, atividades e linhas iniciais
│   ├── src/
│   │   ├── routes/              # Endpoints REST
│   │   ├── middlewares/         # Autenticação JWT
│   │   ├── recomendacao/        # Motor determinístico
│   │   ├── geolocalizacao/      # Estimativa e análise de posição
│   │   ├── ia/                  # Controle de cotas da IA
│   │   ├── lib/                 # Utilitários e limites
│   │   └── server.ts            # Inicialização do Express
│   ├── scripts/                 # Simulação, exportação e análise de campo
│   └── public/coletor.html      # Coletor alternativo para testes
├── mobile/
│   ├── src/
│   │   ├── app/                 # Telas e navegação Expo Router
│   │   ├── api/                 # Cliente HTTP e chamadas da API
│   │   ├── auth/                # Gerenciamento de sessão
│   │   ├── viagem/              # GPS, fila e segundo plano
│   │   ├── components/          # Componentes compartilhados
│   │   └── theme.ts             # Tema visual
│   ├── app.json                 # Permissões e configuração Expo
│   └── eas.json                 # Perfil de build Android
└── docs/
    ├── API.md
    ├── assistente-ia-limites.md
    └── protocolo-teste-campo.md
```

### Entidades principais do banco de dados

- **Usuario:** dados do estudante, hash da senha, consentimento de localização e linha selecionada.
- **Compromisso:** agenda semanal e relação com o estudante e local.
- **Local** e **Atividade:** pontos de interesse, duração e horários cadastrados.
- **Linha:** linha de transporte selecionável.
- **Viagem:** período em que um usuário compartilha sua localização para uma linha.
- **LeituraLocalizacao:** coordenadas, precisão, hora da medição, hora do recebimento e vínculos com usuário, linha e viagem.

O banco é descrito em [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## 🚀 Como executar

**Pré-requisitos:** Node.js compatível com as versões das dependências, PostgreSQL, npm, e (para testar por outra rede) `cloudflared`. Não é necessário publicar o backend em uma hospedagem paga.

### 1. Backend e banco de dados

No diretório `backend/`:

```bash
npm install
```

Crie o arquivo privado `backend/.env` com base em `backend/.env.example`:

```dotenv
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/busai"
JWT_SECRET="SUBSTITUA_POR_UMA_CHAVE_LONGA_E_ALEATORIA"
HABILITAR_COLETOR="false"
ASSISTENTE_IA_HABILITADO="false"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"
```

Os valores acima são **exemplos**. Nunca envie chaves privadas ou senhas ao Git. Deixe a IA desativada até verificar as condições de uso gratuito no [guia do assistente](docs/assistente-ia-limites.md).

Em seguida:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Verifique `http://localhost:3333/health`.

### 2. Túnel para acesso externo

Com o backend ligado, em outro terminal:

```bash
cloudflared tunnel --url http://localhost:3333
```

O endereço `https://...trycloudflare.com` exibido pelo `cloudflared` pode mudar a cada execução.

### 3. Mobile com Expo Go

Na pasta `mobile/`:

```bash
npm install
```

Copie `mobile/.env.example` para `mobile/.env.local` e configure:

```dotenv
EXPO_PUBLIC_API_URL="https://ENDERECO-ATUAL.trycloudflare.com"
```

Depois execute:

```bash
npx expo start --tunnel
```

O Expo Go é útil para testes de interface, mas **não substitui o APK Android** na validação da coleta GPS em segundo plano.

### 4. APK Android atualizado

Com o projeto vinculado à conta Expo/EAS (conforme [guia mobile](mobile/README.md)), execute na pasta `mobile/`:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

O perfil `preview` definido em `mobile/eas.json` produz um **APK**, instalável para demonstração. Após instalar, na tela de login utilize **Servidor** para cadastrar a URL atual do backend; não é necessário recompilar o APK a cada troca do túnel.

**Atenção:** o APK não contém o servidor nem o PostgreSQL. Para a demonstração, mantenha backend, banco e túnel em execução.

## 🧪 Testes e avaliação

A versão consolidada foi validada localmente com **41 testes automatizados aprovados, zero falhas e zero erros TypeScript** no backend e mobile (verificações informadas pela equipe).

```bash
# Dentro de backend/
npm test
npx tsc --noEmit

# Dentro de mobile/
npx tsc --noEmit
```

Os casos automatizados cobrem, entre outros, cálculo das recomendações, combinação de coordenadas, outliers, análise de leituras, validação de lotes, limites de requisições e cotas da IA. **Passar nos testes unitários não equivale a comprovar a precisão do GPS em viagens reais.**

### Evidências e metodologia

A avaliação do artefato foi organizada com referência à abordagem de **Design Science Research (DSR)**, separando:

| Evidência | Situação e uso correto |
|---|---|
| **Testes automatizados** | 41 casos aprovados no ambiente de desenvolvimento; verificar regressões. |
| **Simulações** | Arquivos CSV de experiências com dispositivos sintéticos e intervalos de 5, 10 e 15 segundos; demonstram comportamento sob parâmetros controlados. |
| **Teste piloto de campo** | Registro de coleta real com um aparelho, incluindo limitações da coleta em tela aberta. |
| **Comparação real entre 1, 2 e 3 aparelhos** | Há protocolo e scripts de análise, mas os resultados completos dessa validação **não estão registrados no repositório**. |

O protocolo de coleta, pontos de controle, métricas e registros disponíveis está em [`docs/protocolo-teste-campo.md`](docs/protocolo-teste-campo.md). **Dados sintéticos não devem ser apresentados como observações de campo.**

## ⚠️ Limitações conhecidas

- **Protótipo acadêmico:** backend e PostgreSQL são executados localmente e expostos para demonstração por túnel; isso não configura infraestrutura de produção.
- **Dependência de participantes:** sem uma viagem ativa e leituras recentes confiáveis, não há posição do ônibus a exibir.
- **Mapas:** integração embarcada disponível na configuração iOS; no Android, o app abre a localização em um aplicativo externo de mapas.
- **Coleta em segundo plano:** habilitada no APK Android, sujeita a permissões, políticas de economia de bateria e eventos entregues pelo sistema operacional. O Expo Go exige o app aberto para a coleta.
- **Validade da posição:** o indicador de incerteza é calculado a partir de precisões informadas pelos sensores, não de uma calibração garantida no trajeto.
- **Expiração da viagem:** 180 minutos; a interrupção local só ocorre quando a aplicação consegue executar a verificação de tempo.
- **Recomendações:** horários cadastrados de locais ainda precisam de confirmação; deslocamentos são aproximados, sem roteamento real.
- **IA:** Gemini depende de disponibilidade e cotas externas; pode gerar erros. O limitador local funciona para uma instância e não garante custo zero se faturamento externo for habilitado.
- **Resultados de campo:** a validação com múltiplos aparelhos e pontos de controle permanece uma oportunidade de avaliação futura; não há base para alegar precisão comprovada em qualquer trajeto.

## 📚 Documentação técnica

| Documento | Conteúdo |
|---|---|
| [API REST](docs/API.md) | Contratos de endpoints, autenticação, erros e exemplos. |
| [Assistente IA: limites e operação](docs/assistente-ia-limites.md) | Configuração do Gemini, cotas e cuidados com custos e privacidade. |
| [Protocolo de teste de campo](docs/protocolo-teste-campo.md) | Coleta, simulação separada, pontos de controle e métricas. |
| [Aplicativo mobile](mobile/README.md) | Estrutura do Expo, ambiente Android e parâmetros da coleta. |

---

<div align="center">

### Equipe

**Kauan Alexandre Dias Silva** · **João Victor Miranda Oliveira**

**Orientação:** Prof. Luiz Fernando Moura Piantino  
**Coorientação:** Prof.ª Vania Borges

Universidade do Estado de Minas Gerais — Unidade Passos  
**Sistemas de Informação · TCC · 2026**

</div>
