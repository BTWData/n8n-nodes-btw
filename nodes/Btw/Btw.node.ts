import type { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

/**
 * Node do BTW Intelligence Platform para o n8n.
 *
 * ─── DE ONDE ELE VEIO ───────────────────────────────────────────────────────
 *
 * É o irmão do node do Agenda Vet, com os recursos genéricos (Mensagem e
 * Inbox) e sem o recurso Agenda, que só faz sentido numa clínica. As rotas de
 * `/api/agent/inbox/*` são as mesmas dos dois lados, de propósito: quem já
 * montou fluxo para o vet reaproveita a lógica inteira aqui.
 *
 * ─── O DESENHO QUE IMPORTA ──────────────────────────────────────────────────
 *
 * O agente NUNCA se reativa. `Passar Para Humano` só desliga a IA daquela
 * conversa; devolver o atendimento à IA é ato de gente, pelo botão no topo do
 * Inbox. Um agente capaz de se religar transformaria "assumi essa conversa"
 * numa disputa: a atendente desliga, o fluxo religa na mensagem seguinte, e o
 * lead recebe resposta de dois lugares.
 *
 * Por isso o fluxo típico é: recebe o webhook → `Status Da IA` → se estiver
 * desligada, PARA → senão `Digitando`, pensa, `Enviar Texto`.
 */
export class Btw implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'BTW',
		name: 'btw',
		icon: 'file:btw.svg',
		// Pinta o CORPO do node, não a imagem.
		//
		// O tamanho do ícone dentro do node é CSS do n8n: o arquivo preenche a
		// caixa que recebe, e a caixa é menor que o node. Nenhum SVG muda isso.
		// O que faz o azul alcançar as bordas do quadrado é este campo, que
		// aceita só os nomes da paleta do n8n (nada de hexadecimal).
		iconColor: 'black',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + " (" + $parameter["resource"] + ")"}}',
		description: 'WhatsApp e Inbox do BTW Intelligence Platform, prontos para agentes de IA',
		defaults: { name: 'BTW' },
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		usableAsTool: true,
		credentials: [{ name: 'btwApi', required: true }],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		},
		properties: [
			// ── Recurso ──────────────────────────────────────────────────────────
			{
				displayName: 'Recurso',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'inbox',
				options: [
					{ name: 'Inbox', value: 'inbox' },
					{ name: 'Mensagem', value: 'mensagem' },
				],
			},

			// ── Operações do Inbox ───────────────────────────────────────────────
			{
				displayName: 'Operação',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['inbox'] } },
				default: 'getAiStatus',
				options: [
					{
						name: 'Status Da IA',
						value: 'getAiStatus',
						action: 'Consultar se a IA está ativa na conversa',
						description:
							'Consulte SEMPRE antes de responder: se uma pessoa já assumiu a conversa, o agente precisa ficar calado',
						routing: { request: { method: 'GET', url: '/api/agent/inbox/status' } },
					},
					{
						name: 'Digitando',
						value: 'typing',
						action: 'Mostrar digitando no WhatsApp do contato',
						description:
							'Mostra "digitando…" pelo tempo proporcional ao texto e devolve delayMs para o fluxo esperar antes de enviar',
						routing: { request: { method: 'POST', url: '/api/agent/inbox/typing' } },
					},
					{
						name: 'Passar Para Humano',
						value: 'handoff',
						action: 'Desligar a IA e entregar a conversa a uma pessoa',
						description:
							'Desliga a IA NESTA conversa e, opcionalmente, avisa alguém. Só desliga: religar é ato de gente, pelo Inbox',
						routing: { request: { method: 'POST', url: '/api/agent/inbox/handoff' } },
					},
				],
			},

			// ── Operações de Mensagem ────────────────────────────────────────────
			{
				displayName: 'Operação',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['mensagem'] } },
				default: 'sendText',
				options: [
					{
						name: 'Enviar Texto',
						value: 'sendText',
						action: 'Enviar mensagem de texto no WhatsApp',
						description: 'Envia pelo número do cliente; a mensagem aparece no Inbox como qualquer outra',
						routing: { request: { method: 'POST', url: '/api/agent/inbox/messages' } },
					},
				],
			},

			// ── Telefone: comum a tudo ───────────────────────────────────────────
			{
				displayName: 'Telefone',
				name: 'telefone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '5511999999999',
				description:
					'Telefone do contato. Aceita com ou sem máscara, e também o JID inteiro do WhatsApp',
				displayOptions: { show: { operation: ['getAiStatus'] } },
				routing: { send: { type: 'query', property: 'telefone' } },
			},
			{
				displayName: 'Telefone',
				name: 'telefoneCorpo',
				type: 'string',
				required: true,
				default: '',
				placeholder: '5511999999999',
				description:
					'Telefone do contato. Aceita com ou sem máscara, e também o JID inteiro do WhatsApp',
				displayOptions: { show: { operation: ['sendText', 'typing', 'handoff'] } },
				routing: { send: { type: 'body', property: 'telefone' } },
			},

			// ── Enviar Texto ─────────────────────────────────────────────────────
			{
				displayName: 'Texto',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '',
				description: 'O texto exato a enviar',
				displayOptions: { show: { operation: ['sendText'] } },
				routing: { send: { type: 'body', property: 'text' } },
			},

			// ── Digitando ────────────────────────────────────────────────────────
			//
			// Manda o TEXTO que será enviado, não uma duração: o servidor calcula
			// quanto tempo um humano levaria e devolve `delayMs` para o fluxo
			// esperar. Assim o ritmo fica igual em todos os fluxos, e quem monta
			// o workflow não precisa responder "quanto tempo isso levaria".
			{
				displayName: 'Texto Que Será Enviado',
				name: 'textoTyping',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				description:
					'A mensagem que virá em seguida. Serve só para medir o tempo do "digitando…" — ela NÃO é enviada por esta operação',
				displayOptions: { show: { operation: ['typing'] } },
				routing: { send: { type: 'body', property: 'texto' } },
			},
			{
				displayName: 'Presença',
				name: 'presenca',
				type: 'options',
				default: 'composing',
				options: [
					{ name: 'Digitando', value: 'composing' },
					{ name: 'Gravando Áudio', value: 'recording' },
					{ name: 'Parou', value: 'paused' },
				],
				displayOptions: { show: { operation: ['typing'] } },
				routing: { send: { type: 'body', property: 'presenca' } },
			},
			{
				displayName: 'Ajustes De Ritmo',
				name: 'ritmo',
				type: 'collection',
				placeholder: 'Adicionar ajuste',
				default: {},
				displayOptions: { show: { operation: ['typing'] } },
				options: [
					{
						displayName: 'Ms Por Caractere',
						name: 'msPorCaractere',
						type: 'number',
						default: 55,
						description: 'Padrão 55. Valores fora da faixa segura são aparados, não recusados',
						routing: { send: { type: 'body', property: 'msPorCaractere' } },
					},
					{
						displayName: 'Mínimo (Ms)',
						name: 'minMs',
						type: 'number',
						default: 800,
						routing: { send: { type: 'body', property: 'minMs' } },
					},
					{
						displayName: 'Máximo (Ms)',
						name: 'maxMs',
						type: 'number',
						default: 9000,
						routing: { send: { type: 'body', property: 'maxMs' } },
					},
				],
			},

			// ── Passar Para Humano ───────────────────────────────────────────────
			{
				displayName: 'Motivo',
				name: 'motivo',
				type: 'string',
				default: '',
				placeholder: 'Terminou a triagem / o lead pediu para falar com uma pessoa',
				description:
					'Aparece na timeline do Inbox e responde "por que a IA está calada aqui?" para quem abrir a conversa depois',
				displayOptions: { show: { operation: ['handoff'] } },
				routing: { send: { type: 'body', property: 'motivo' } },
			},
			{
				displayName: 'Avisar Telefone',
				name: 'notificarTelefone',
				type: 'string',
				default: '',
				description:
					'Quem receberá o aviso de que o lead pediu atendimento. Número, ou id de grupo do WhatsApp (@g.us)',
				displayOptions: { show: { operation: ['handoff'] } },
				routing: { send: { type: 'body', property: 'notificarTelefone' } },
			},
			{
				displayName: 'Mensagem Do Aviso',
				name: 'mensagemNotificacao',
				type: 'string',
				typeOptions: { rows: 2 },
				default: '',
				description: 'Só é enviada se "Avisar Telefone" estiver preenchido',
				displayOptions: { show: { operation: ['handoff'] } },
				routing: { send: { type: 'body', property: 'mensagemNotificacao' } },
			},
		],
	};
}
