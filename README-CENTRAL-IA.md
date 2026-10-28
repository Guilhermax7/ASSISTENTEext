# Sra. Luck — Central de Inteligência Artificial 1.4.0

## Arquitetura encontrada

O código de origem analisado é a versão 1.3.21 de uma extensão Chrome Manifest V3, com `popup.html`, `templates.js`, `ai-assistant.js`, `simulacoes.js`, `negociacao.js` e scripts da Carteira. **Não havia servidor, banco de dados ou projeto Vercel no ZIP.** A v1.4.0 acrescenta um **serviço auxiliar local** em `ia-server/` e um painel `central-ia.html`, preservando os módulos originais.

## Pré-requisitos

- Chrome e Node.js **20 ou superior** no **mesmo computador** no modo local;
- Ollama rodando com modelo instalado, **ou** FreeLLMAPI Desktop ligado e com chave unificada;
- Administradora autorizada para cadastrar provedores e configurar envios externos.

Não é necessário `npm install` para o serviço local (biblioteca padrão do Node).

## Primeiro início no Windows (PowerShell)

1. Extraia o ZIP para uma pasta fixa; **não** instale a extensão a partir de uma pasta temporária.
2. Abra o PowerShell nessa pasta, e gere duas credenciais aleatórias diferentes, com 32 bytes cada:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Armazene as duas credenciais em cofre seguro; configure-as para a **sessão de execução** (não adicione a arquivos dentro da pasta da extensão):

```powershell
$key = Read-Host 'Informe SRA_LUCK_MASTER_KEY' -AsSecureString
$token = Read-Host 'Informe SRA_LUCK_ADMIN_TOKEN' -AsSecureString
$env:SRA_LUCK_MASTER_KEY = [System.Net.NetworkCredential]::new('', $key).Password
$env:SRA_LUCK_ADMIN_TOKEN = [System.Net.NetworkCredential]::new('', $token).Password
node .\ia-server\server.mjs
```

A primeira credencial cifra as chaves dos provedores. **Se perder a chave mestre, não conseguirá recuperar as credenciais criptografadas.** Use a mesma chave mestre em reinicializações. O token administrativo controla o acesso local; guarde-o com cuidado.

4. Em `chrome://extensions`, ative **Modo do desenvolvedor**, selecione **Carregar sem compactação** e a pasta extraída. Se já usava a extensão, recarregue-a em vez de desinstalá-la.
5. Em **Templates → IA Coringa → Central de IA**, cole o token administrativo e clique em **Conectar**.
6. Cadastre o provedor e clique em **Detectar modelos**; sem resposta da API, nenhum modelo será apresentado como verificado.
7. Em **Política e agentes**, selecione conexão/modelo para Cobrança e Atendimento. A política `free_only` começa ativada.
8. Volte ao card IA Coringa → **Conexão** e selecione **Central de IA (serviço seguro multiprovedor)**. O token já salvo no painel é reutilizado. Se não aparecer, informe o token da Central; não a chave do provedor. Salve.

## URLs / protocolos

| Tipo | Base URL | Modelos | Geração | Credencial |
| --- | --- | --- | --- | --- |
| Ollama local nativo | `http://127.0.0.1:11434` | `/api/tags` | `/api/chat` | sem chave |
| Ollama compatível OpenAI | `http://127.0.0.1:11434` | `/v1/models` | `/v1/chat/completions` | sem chave |
| FreeLLMAPI Desktop | `http://127.0.0.1:31415/v1` | `/models?execution_status=ready` | `/chat/completions` | Bearer com chave unificada |
| Compatível OpenAI | `https://host-autorizado/v1` | `/models` | `/chat/completions` | Bearer do provedor |

Ollama oferece tanto o protocolo nativo quanto a opção OpenAI-compatible como dois tipos de conexão. A listagem para cada tipo é consultada na API correspondente. O FreeLLMAPI oferece `auto`, `auto:fast`, `auto:smart`, `auto:reliable`, além dos modelos realmente retornados. **Modelos `auto:*` do FreeLLMAPI já fazem seu próprio roteamento, portanto não recebem fallback adicional externo do serviço.**

Para um endpoint personalizado, o host **HTTPS** precisa estar na lista do administrador (ver abaixo). Groq, OpenRouter e Gemini via endpoint OpenAI-compatible são opções de conexão, **não configurações automaticamente provisionadas**. Para Gemini use a superfície OpenAI-compatible que o seu provedor documentar, não a API nativa `generateContent` neste backend.

## Política de custos e consentimento

- `free_only = true` (padrão) aceita somente **modelo local instalado e confirmado** no `/api/tags` de um Ollama em loopback. Modelos `:cloud` são bloqueados.
- FreeLLMAPI pode encaminhar solicitações a serviços externos. A listagem `ready` **não é prova de gratuidade**, portanto permanece bloqueado no modo `free_only`.
- Para permitir provedor externo, desative `free_only` conscientemente e autorize **envio externo** separadamente no agente. Isso **não** confirma que o uso seja gratuito.
- Um fallback só ocorre com configuração explícita do agente e em falha considerada recuperável (429, 502, 503, 504). Fallback não dispara automaticamente para modelo `auto:*` do FreeLLMAPI.
- **Nunca** é feita transferência silenciosa de mensagem real para serviço externo apenas pelo fallback. O painel de teste usa textos fictícios e exige consentimento.
- O backend devolve consumo de tokens e latência **quando a API de origem fornece esses dados**. Não calcula custo monetário presumido.

## Segurança

- O servidor escuta somente em **127.0.0.1:45421**, não exposto à internet.
- O token de acesso é exigido em todas as rotas de dados (inclusive saúde/estado); a origem de navegador deve ser `chrome-extension://<id>`.
- As chaves dos provedores são cifradas com AES-256-GCM e armazenadas no diretório do usuário (`~/.sra-luck-ia/connections.json` por padrão); nunca devolvidas pelo endpoint `/api/state`.
- A extensão armazena **somente o token de acesso ao serviço** para reutilizar o painel; ele dá acesso administrativo ao serviço e deve ser tratado como credencial sensível. A senha mestre do backend não entra no navegador.
- Não há redirecionamento automático HTTP. URLs de servidores locais limitadas às portas 11434 e 31415; hosts remotos precisam de HTTPS e allowlist, verificação de endereços DNS e resolução fixada para a conexão HTTPS.
- Histórico não é salvo em logs. Há mascaramento backend de CPF, CNPJ, e-mail e telefones. Minimize outros dados antes de gerar, especialmente em modelos externos.
- **Modo legado:** a configuração direta dos provedores da versão 1.3.21 continua opcional para preservar a compatibilidade, **mas ela ainda armazena chaves no `chrome.storage.local` e faz requisições diretas**. Não use esse modo para dados reais sob a política de chaves exclusivamente no backend. Após migrar, use **Esquecer chave salva** na configuração legada, sem apagar as conexões da Central.
- O serviço local não oferece autenticação de múltiplos usuários, RBAC por funcionário, auditoria persistente, cofre empresarial nem implantação multiusuário. Seu token funciona como autenticação administrativa única. Não use como backend público em produção.
- Qualquer produção, Vercel ou acesso remoto exige arquitetura **backend privada autenticada** e integração adicional de identidade. `localhost` do servidor Vercel **não** é o PC da atendente. **Não publique portas de Ollama/FreeLLMAPI.**

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `SRA_LUCK_MASTER_KEY` | sim | Chave de criptografia da configuração, no mínimo 32 caracteres. |
| `SRA_LUCK_ADMIN_TOKEN` | sim | Token de autenticação para a API local e a extensão, no mínimo 32 caracteres. |
| `SRA_LUCK_PORT` | não | Padrão 45421. A extensão usa 45421; mudar requer ajustar o cliente. |
| `SRA_LUCK_DATA_DIR` | não | Local dos dados criptografados e configuração; padrão `~/.sra-luck-ia`. |
| `SRA_LUCK_ALLOWED_EXTERNAL_HOSTS` | não | Hosts HTTPS adicionais separados por vírgula, aprovados pelo administrador. |
| `SRA_LUCK_PROVIDER_TIMEOUT_MS` | não | Timeout de provedor, entre 500 e 30.000 ms; padrão 30.000. |

Hosts remotos preautorizados: `api.openai.com`, `api.groq.com`, `openrouter.ai`, `generativelanguage.googleapis.com`, `api.anthropic.com` e `api.deepseek.com`. **Autorização de host não implica custo zero.**

## APIs locais disponíveis (todas exigem Bearer com token administrativo)

- `GET /api/health` — serviço vivo;
- `GET /api/state` — conexões sem segredos, modelos consultados, agentes e logs em memória;
- `POST /api/connections` — criar/editar conexão (o campo `api_key` só substitui a chave quando informado);
- `POST /api/connections/{id}/discover` — listagem real de modelos;
- `POST /api/connections/{id}/test` — teste de acesso **à listagem** (sem custo de geração);
- `DELETE /api/connections/{id}` — exclusão, limpa referências de agentes;
- `PUT /api/settings` — política/roteamento/agentes;
- `POST /api/generate` — geração autorizada (agente, `task`, mensagens, `context_authorized`, parâmetros).

Os erros possuem `{error:{code,message,retryable}}` e não devolvem credenciais nem textos de clientes.

## Como testar

```bash
node --check ia-server/server.mjs
node ia-server/test-integration.mjs
```

O conjunto executa servidores **fictícios** nas portas 11434/31415, testa o serviço e os encerra. **Não execute com Ollama real ou FreeLLMAPI real nas mesmas portas**; pare esses serviços antes do teste ou execute em ambiente de desenvolvimento isolado. A verificação das conexões reais deve ser feita no painel, no computador onde estão instaladas.

## Arquivos criados / modificados

- `ia-server/server.mjs` **novo** — credenciais cifradas, conexões, modelos, execução, políticas, logs, filtros e fallback.
- `ia-server/test-integration.mjs` **novo** — cenários de integração com serviços fictícios.
- `central-ia.html`, `central-ia.css`, `central-ia.js` **novos** — painel de configuração.
- `ai-assistant.js` **modificado** — nova opção `central`, chamada à API local, preserva IA Coringa e modo legado.
- `templates.js` **modificado** — acesso ao painel e seletor de conexão da Central.
- `manifest.json` **modificado** — versão e descrição.
- `README-CENTRAL-IA.md` **novo** — instalação, ambiente, segurança, uso e limitações.
- `LEIA-ME.txt` **atualizado**, com referência às instruções completas.

## Resultados verificados no ambiente de desenvolvimento

- O serviço Ollama em `127.0.0.1:11434` **não estava ativo**.
- O serviço FreeLLMAPI em `127.0.0.1:31415` **não estava ativo**.
- Não foi detectado nenhum modelo real neste ambiente.
- Testes locais de integração com mocks: **31 verificações passaram**, incluindo Ollama online/offline, discovery, FreeLLMAPI com chave válida/inválida, fallback, bloqueio de custos, proteção de credenciais, agentes separados, timeout, erros e SSRF.
- Não foram verificadas chaves reais, contas comerciais, preço ou ambiente Vercel.
