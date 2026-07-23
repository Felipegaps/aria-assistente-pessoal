# ARIA — Assistente Pessoal (estilo JARVIS)

Assistente pessoal multi-agent com controle de casa inteligente, acesso a
e-mail, agenda e Drive do Google, listas de compras compartilhadas e uma
interface de comando por voz e texto. Inspirada no JARVIS.

Stack: React + Vite + TypeScript · Firebase (Auth + Firestore) · Gemini
(orquestrador) · Home Assistant (ponte para o Google Home).

---

## Visão geral da arquitetura

A ARIA é organizada como um sistema **multi-agent**: um orquestrador central
recebe o comando em linguagem natural, decide qual sub-agente deve agir e
executa a ação de verdade contra os serviços reais.

```
Usuário (voz/texto no HUD)
        │
        ▼
Orquestrador (ariaAgent.ts + Gemini function calling)
        │
        ├── Email Agent      → Gmail API (privado)
        ├── Calendar Agent   → Google Calendar API (compartilhável)
        ├── Drive Agent      → Google Drive API (privado)
        ├── Shopping Agent   → Firestore (compartilhado na household)
        └── Home Agent       → Home Assistant REST API → Google Home
```

---

## Multiusuário e household

Cada pessoa tem **login próprio** (Firebase Authentication). Os usuários se
agrupam numa **household** — um espaço compartilhado que permite ver a agenda
um do outro e alimentar as listas de compras em conjunto.

- Quem se cadastra primeiro cria a household (o `householdId` é o próprio uid).
- O segundo membro se cadastra informando esse `householdId` (código de convite).
- Dados privados (e-mail, Drive, conversa com a ARIA) nunca são compartilhados.
- A agenda é compartilhada em modo **somente leitura** para o outro membro; só
  o dono edita/sincroniza a própria.

As permissões são garantidas pelas regras do Firestore (`firestore.rules`).

---

## Estrutura do repositório

```
/
├── .env.example            → modelo das variáveis de ambiente
├── .gitignore
├── firestore.rules         → regras de segurança do banco
├── index.html
├── package.json
├── README.md
└── src/
    ├── App.tsx             → roteamento e sidebar
    ├── main.tsx
    ├── index.css
    ├── types/
    ├── services/
    ├── agents/
    └── components/
```

### src/types/
| Arquivo | Descrição |
|---|---|
| `household.ts` | Household, membros e perfil de usuário |
| `shopping.ts` | Itens das listas (casa / online) |
| `home.ts` | Estado de dispositivos da casa inteligente |
| `calendar.ts` | Eventos da agenda |
| `email.ts` | Mensagens de e-mail |
| `drive.ts` | Arquivos do Drive |

### src/services/
| Arquivo | Descrição |
|---|---|
| `authService.ts` | Login, registro e vínculo à household |
| `googleAuthService.ts` | Conexão única com o Google (Calendar + Gmail + Drive num só consentimento) |
| `shoppingService.ts` | CRUD das listas com sincronização em tempo real |
| `calendarService.ts` | Busca eventos e sincroniza para cache no Firestore |
| `gmailService.ts` | Lista e-mails recentes (somente leitura) |
| `driveService.ts` | Lista e busca arquivos (somente leitura) |
| `homeService.ts` | Comunicação com a API REST do Home Assistant |
| `conversationService.ts` | Persistência do histórico de conversa da ARIA |

### src/agents/
| Arquivo | Descrição |
|---|---|
| `ariaAgent.ts` | Orquestrador central com Gemini + function calling + memória |

### src/components/
| Arquivo | Descrição |
|---|---|
| `AuthScreen.tsx` | Tela de login/registro |
| `AriaHUD.tsx` | Interface central de comando (voz + chat, estilo JARVIS) |
| `ShoppingAgent.tsx` | Listas de compras (abas casa / online) |
| `CalendarAgent.tsx` | Agenda com abas "minha" / "do cônjuge" |
| `EmailAgent.tsx` | Caixa de entrada resumida |
| `DriveAgent.tsx` | Busca e listagem de arquivos |
| `HomeAgent.tsx` | Grade de dispositivos da casa inteligente |

---

## Os agentes em detalhe

### Email Agent (privado)
Conecta a conta Google do usuário (escopo `gmail.readonly`) e lista as
mensagens recentes com remetente, assunto e resumo. Nunca compartilhado com
outros membros da household.

### Calendar Agent (compartilhável)
Busca os eventos da agenda do usuário e os grava num cache no Firestore
(`users/{uid}/calendarCache`). Esse cache é o que permite ao cônjuge visualizar
a agenda sem precisar de acesso OAuth à conta alheia — ele apenas lê o cache
liberado pelas regras de segurança.

### Drive Agent (privado)
Lista os arquivos recentes e busca por nome (escopo `drive.readonly`). Cada
arquivo abre diretamente no Google Drive.

### Shopping Agent (compartilhado)
Duas listas: **casa** (itens necessários, tipo mercado) e **online** (itens
desejados, com link do produto). Sincronização em tempo real: quando um membro
adiciona um item, aparece na hora para o outro.

### Home Agent (via Home Assistant)
O Google Home não oferece uma API REST aberta para apps de terceiros
controlarem dispositivos — o SDK oficial existe apenas nativo (Android/iOS).
Por isso a ARIA usa o **Home Assistant** como ponte: ele se integra ao Google
Home e expõe uma API REST simples que o app consome. Liga/desliga luzes e
tomadas, ajusta termostatos, tranca/destranca fechaduras.

Por enquanto funciona apenas dentro da rede Wi-Fi de casa (sem acesso remoto).

---

## Orquestrador

O `ariaAgent.ts` recebe um comando em linguagem natural e usa o Gemini com
**function calling** para decidir qual ferramenta chamar. O fluxo:

1. Gemini analisa o comando e o histórico da conversa.
2. Se precisar de uma ação, escolhe a ferramenta e os parâmetros.
3. O orquestrador executa a função real contra o serviço correspondente.
4. Gemini transforma o resultado bruto numa resposta natural em português.

Mantém **memória de conversa por usuário**, persistida no Firestore, para
entender referências a mensagens anteriores.

Ferramentas registradas: listar e-mails, listar/sincronizar agenda, adicionar
item de compra, controlar/listar dispositivos, buscar/listar arquivos do Drive.

---

## Interface (HUD estilo JARVIS)

O `AriaHUD.tsx` é a tela central de comando:
- Núcleo animado que pulsa durante o processamento.
- Entrada por **voz** (Web Speech API, pt-BR) e por texto.
- Resposta por **voz** (text-to-speech) opcional.
- Conectado ao orquestrador — todo o pipeline de ponta a ponta.

---

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar as variáveis de ambiente
cp .env.example .env
# ... e preencher o .env com suas chaves

# 3. Rodar em desenvolvimento
npm run dev
```

### Pré-requisitos externos

**Google Cloud Console**
- Criar credenciais OAuth 2.0 (Client ID).
- Habilitar Calendar API, Gmail API e Drive API.
- Escopos: `calendar.events.readonly`, `gmail.readonly`, `drive.readonly`.

**Firebase**
- Ativar Authentication (e-mail/senha).
- Publicar as regras do `firestore.rules`.

**Home Assistant**
- Instalar o Home Assistant OS (Raspberry Pi ou mini PC).
- Integrar a conta Google Home (importa os dispositivos).
- Ativar HTTPS local (certificado autoassinado) e confiar nele no celular —
  necessário porque o app roda em HTTPS e o navegador bloqueia chamadas para
  `http://` simples (mixed content).
- Gerar um Long-Lived Access Token no perfil.

---

## Notas de segurança

- E-mail, Drive e histórico de conversa são sempre **privados** por usuário.
- A agenda é compartilhada apenas em leitura, e apenas dentro da mesma household.
- Toda coleção nova no Firestore precisa de regra explícita — sem regra, o
  Firestore nega o acesso por padrão.
- O `.env` está no `.gitignore` e nunca deve ser commitado.

---

## Próximos passos possíveis

- Acesso remoto ao Home Assistant (Nabu Casa ou túnel) para controlar a casa
  fora do Wi-Fi.
- Código de convite mais amigável para a household (hoje é o uid cru).
- Carregar dinamicamente os membros da household no CalendarAgent.
- Ações de escrita (enviar e-mail, criar evento) com confirmação explícita.
- Empacotar como PWA instalável no Android.
