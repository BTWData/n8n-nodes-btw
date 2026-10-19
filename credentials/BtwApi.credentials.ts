import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class BtwApi implements ICredentialType {
	name = 'btwApi';

	displayName = 'BTW Intelligence Platform API';

	documentationUrl = 'https://platform.btwdata.tech';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Chave gerada no painel em Integrações > Agente de IA no WhatsApp > Gerar chave (formato btw_live_...). Ela aparece uma única vez.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://platform.btwdata.tech',
			description: 'URL base da instância da plataforma.',
		},
	];

	// Toda chamada leva a chave no cabeçalho Authorization: Bearer <apiKey>.
	//
	// É a chave que decide de QUAL cliente é a conversa: o servidor resolve
	// empresa e cliente a partir dela e ignora qualquer id que venha no corpo.
	// Por isso um fluxo só atende um cliente — para dois, duas credenciais.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// O teste bate no /ping, que responde 200 para TODA chave válida.
	//
	// A primeira versão apontava para /inbox/status com um telefone inexistente,
	// achando que um 404 já provava a autenticação. Prova para quem lê o log,
	// mas o n8n trata qualquer resposta fora de 2xx como credencial inválida:
	// a credencial ficava VERMELHA ("The resource you are requesting could not
	// be found") mesmo tendo autenticado, e o `lastUsedAt` da chave no banco
	// provava que tinha autenticado.
	//
	// Teste de credencial precisa de rota que responda 200 sem depender de
	// nenhum dado existir.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/agent/ping',
		},
	};
}
