# n8n-nodes-btw

Node do [BTW Intelligence Platform](https://platform.btwdata.tech) para o n8n:
WhatsApp e Inbox do painel, prontos para agentes de IA.

Irmão do [`n8n-nodes-agendavet`](https://www.npmjs.com/package/n8n-nodes-agendavet).
As rotas do agente são as mesmas nos dois produtos, então um fluxo escrito para
um funciona no outro trocando só a credencial.

## Instalação

No n8n self-hosted: **Configurações → Community nodes → Install** e informe:

```
n8n-nodes-btw
```

## Credencial

Gere a chave no painel, em **Integrações → Agente de IA no WhatsApp → Gerar
chave**. Ela aparece uma única vez.

| Campo | Valor |
|---|---|
| API Key | `btw_live_...` |
| Base URL | `https://platform.btwdata.tech` |

A chave decide **de qual cliente** é a conversa: o servidor resolve empresa e
cliente a partir dela e ignora qualquer id que venha no corpo. Por isso uma
credencial atende um cliente; para dois clientes, duas credenciais.

## Operações

### Inbox

| Operação | O que faz |
|---|---|
| **Status Da IA** | Diz se a IA ainda está ativa naquela conversa |
| **Digitando** | Mostra "digitando…" pelo tempo proporcional ao texto e devolve `delayMs` |
| **Passar Para Humano** | Desliga a IA na conversa e, opcionalmente, avisa alguém |

### Mensagem

| Operação | O que faz |
|---|---|
| **Enviar Texto** | Envia pelo número do cliente; aparece no Inbox como qualquer mensagem |

## O fluxo típico

```
Lead manda mensagem
        │
        ▼
Plataforma dispara o webhook (assinado em X-Signature)
        │
        ▼
   fluxo no n8n
        │
        ├─ 1. Status Da IA ......... ainda posso falar?
        │      └─ iaAtiva = false → PARA aqui
        ├─ 2. Digitando ............ manda o texto, recebe delayMs, espera
        ├─ 3. Enviar Texto ......... a resposta
        └─ 4. Passar Para Humano ... quando o prompt manda parar
```

### Consulte o status antes de responder

O webhook pode ter saído meio segundo antes de alguém apertar o botão no Inbox.
Sem consultar, o agente responde por cima da atendente e o lead recebe duas
respostas diferentes. É essa consulta que faz o botão do Inbox valer.

### O agente nunca se reativa

**Passar Para Humano** só desliga. Devolver o atendimento à IA é ato de gente,
pelo botão no topo da conversa. Um agente capaz de se religar transformaria
"assumi essa conversa" numa disputa: a atendente desliga, o fluxo religa na
mensagem seguinte, e o lead recebe resposta de dois lugares.

### Mande o texto no "Digitando", não uma duração

Quem monta o fluxo não deveria ter que responder "quanto tempo um humano
levaria para digitar isso". Mandando o texto, a conta sai do servidor e o ritmo
fica igual em todos os fluxos. Os ajustes de ritmo são **aparados** em vez de
recusados: um valor exagerado não derruba o atendimento com um erro de
configuração.

## Como ferramenta de agente

O node é `usableAsTool`, então dá para ligá-lo direto num nó de agente de IA e
deixar o próprio modelo decidir quando chamar cada operação. É como o agente
"passa para humano" sozinho: basta a instrução no prompt.

## Verificar a assinatura do webhook

A plataforma assina o corpo do POST com HMAC-SHA256 do segredo da instalação e
manda no cabeçalho `X-Signature` (base64url). Vale conferir no fluxo antes de
agir: a URL do webhook do n8n é publicamente alcançável por definição.

## Licença

MIT
