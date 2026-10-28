# Sra. Luck Premium 1.4.1 — Central de IA na nuvem (sem iniciar servidor local)

## O que foi implementado

O ZIP contém a extensão Chrome atualizada e um **backend separado para implantação na Vercel** (`cloud-backend/`). A extensão continua a oferecer Carteira, Templates, IA Coringa e Simulações sem exigir o serviço local para os recursos não relacionados à IA. O painel da Central agora aceita um **endereço HTTPS** da implantação, além do serviço local da versão 1.4.0.

**Ainda não foi implantado em uma conta real.** Não há endereço de produção, chaves de produção ou serviços Ollama/FreeLLMAPI acessíveis neste ambiente. Depois de uma implantação na nuvem, o backend responde sob demanda sem precisar executar `node` manualmente no computador. Isso não equivale a garantia de disponibilidade permanente: depende dos planos, cotas, pagamentos e funcionamento dos serviços usados.

## Arquitetura

`Extensão Chrome → HTTPS Vercel Function → Upstash Redis (configuração persistente) → provedor de IA HTTPS`.

- Credenciais dos provedores são cifradas com AES-256-GCM antes de serem armazenadas no Redis. A chave mestre reside somente no ambiente de servidor.
- As conexões, políticas de custo e configurações dos agentes são persistidas no Redis.
- O navegador guarda um token de acesso à Central, **não as chaves dos provedores**. Esse token é administrativo e deve ser usado apenas pelo responsável.
- Cada requisição exige autenticação. Somente origens Chrome autorizadas podem acessar a API pelo navegador.
- Endpoints personalizados precisam usar HTTPS, estar autorizados por host e passar pela verificação anti-SSRF.
- `free_only` vem habilitado e impede modelos externos sem gratuidade comprovada. Como não há Ollama no servidor, desative-o *conscientemente* para usar um provedor online, após aprovar as condições de cobrança desse provedor.
- O painel antigo de **modo direto** continua disponível para compatibilidade; esse modo **não** usa o backend para guardar a chave.

## Implantação inicial: Vercel + Upstash

1. Extraia o ZIP. Entre no diretório `cloud-backend/` e publique **esse diretório como a raiz de um projeto Vercel**. Uma forma é armazená-lo em repositório Git privado e conectá-lo pela opção "Add New Project" da Vercel; configure o Root Directory como `cloud-backend`, se o repositório for o ZIP inteiro. O arquivo `vercel.json` contém a rota `/api/*` e a duração máxima de execução.
2. Crie um banco Upstash Redis e copie a URL HTTPS e o *REST token* de acesso de escrita. Os dados são persistentes, inclusive quando a função é reiniciada. **Não publique essas informações no Git nem na extensão.**
3. Gere no seu computador duas sequências aleatórias diferentes de 32 bytes (por exemplo `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, duas vezes). Configure as seguintes variáveis em **Vercel > Project > Settings > Environment Variables > Production**:

   | Variável | Conteúdo |
   | --- | --- |
   | `SRA_LUCK_MASTER_KEY` | Primeira sequência hexadecimal, para cifra. Mantenha constante nas atualizações. |
   | `SRA_LUCK_ADMIN_TOKEN` | Segunda sequência, acesso administrativo. |
   | `UPSTASH_REDIS_REST_URL` | URL REST HTTPS do banco Upstash. |
   | `UPSTASH_REDIS_REST_TOKEN` | Token REST com permissão de leitura e escrita. |
   | `SRA_LUCK_ALLOWED_EXTENSION_ORIGINS` | `chrome-extension://` + ID da extensão em `chrome://extensions` (32 letras). Separe múltiplos por vírgula. |
   | `SRA_LUCK_ALLOWED_EXTERNAL_HOSTS` | Opcional. Hosts HTTPS adicionais aprovados, separados por vírgula (sem protocolo). |
   | `SRA_LUCK_PROVIDER_TIMEOUT_MS` | Opcional: 500 a 30000; padrão 30000. |

4. Faça o deploy de **produção**. Mudanças nas variáveis da Vercel exigem nova implantação para se refletirem na execução. Não habilite o backend para o público sem token. Certifique-se de utilizar o domínio HTTPS correto.
5. Carregue a pasta da extensão em `chrome://extensions` (se já instalada, mantenha-a e recarregue). Consulte o ID da extensão em **Detalhes** e confirme que coincide com `SRA_LUCK_ALLOWED_EXTENSION_ORIGINS`. Se precisar ajustar, modifique a variável na Vercel e faça redeploy.
6. Abra **Templates → IA Coringa → ◈ Central IA**. No campo **Endereço do serviço**, informe `https://seu-projeto.vercel.app` (sem `/api`, barra final ou parâmetros). Informe `SRA_LUCK_ADMIN_TOKEN` e conecte.
7. Cadastre um provedor HTTPS (Groq/OpenRouter/OpenAI-compatible) e sua chave; clique **Detectar modelos**. Os modelos apresentados precisam ter vindo da consulta à API. Escolha modelos independentes para Cobrança e Atendimento, configure `free_only` e as permissões de envio externo. Salve.
8. Na IA Coringa, use o provedor **Central de IA**. O endereço HTTPS e token do painel são reutilizados. Use dados fictícios no teste inicial. Só depois de validar as permissões, teste o fluxo real com revisão humana.

### Comportamento esperado depois da implantação

- Não é necessário iniciar Node.js, Ollama ou FreeLLMAPI Desktop ao abrir o Chrome para utilizar um **provedor de IA online** configurado no backend de nuvem.
- A Carteira, o PIX, os templates estáticos e as simulações continuam disponíveis mesmo durante indisponibilidade da IA.
- Se a Vercel, a conta do provedor ou a conexão com a internet estiver indisponível, **a geração de IA poderá falhar**. Não existe garantia técnica de funcionamento ininterrupto.

## Sobre Ollama e FreeLLMAPI locais

`localhost` dentro de uma função Vercel **não é o computador da atendente**. Portanto os endpoints `http://127.0.0.1:11434` e `http://127.0.0.1:31415/v1` **não funcionam a partir da nuvem**. O backend bloqueia essas URLs expressamente. Não publique portas locais na internet.

Se quiser manter Ollama/FreeLLMAPI no computador, é possível continuar no modo local da versão anterior, com o serviço iniciado automaticamente ao entrar no Windows, mas **o computador precisa permanecer ligado**. Para independência do computador, use um provedor online ou infraestrutura privada hospedando o modelo, com autenticação e configuração de rede próprias.

## Segurança e limitações

- O token da Central é administrativo e fica no armazenamento local do navegador quando a opção de salvar está ativa. **Não o distribua a funcionárias.** Para uso multiusuário é indispensável autenticação individual, papéis administrativos e um token de geração de escopo limitado (não incluídos nesta versão).
- A coleta de mensagens das clientes depende das permissões de leitura disponíveis no WhatsApp/Tallos. A Central só recebe o contexto quando a pessoa solicita a resposta. Faça avaliação de LGPD/contratos antes de habilitar provedores externos.
- Alterações administrativas simultâneas nas configurações podem sofrer conflito de gravação. Esta versão destina-se a **um painel administrativo por vez**.
- A listagem de modelos é realmente consultada no provedor; os testes automatizados com APIs simuladas não são prova de disponibilidade de modelos comerciais.
- Os logs técnicos em memória na função Vercel são efêmeros; a persistência de auditoria multiusuário não foi implementada.
- Hospedagem, Redis e chamadas de IA podem ter limites e cobranças próprios. A política `free_only` protege contra roteamento não autorizado, mas não prova a gratuidade de qualquer provedor.

## Verificações automatizadas nesta entrega

No diretório da extensão (Node 20+):

```sh
node --check cloud-backend/api/index.mjs
node cloud-backend/test-cloud.mjs
node ia-server/test-integration.mjs
```

- **18** verificações do backend cloud usando um Redis simulado: CORS, autenticação, persistência, criptografia de chave, configuração dos agentes, `free_only`, bloqueio de localhost e idempotência.
- **31** verificações do serviço local anterior, usando servidores de IA simulados.
- **Nenhuma** implantação em Vercel, conexão real ao Upstash ou chamada a um modelo real foi executada neste ambiente.
- Não houve validação final via navegador automatizado: a política do navegador disponível bloqueia a navegação no ambiente de testes. A sintaxe JavaScript dos arquivos alterados foi verificada.

## Arquivos principais

- `cloud-backend/api/index.mjs` — novo backend em Vercel Functions, com estado persistido via Upstash Redis e restrições de segurança para nuvem.
- `cloud-backend/vercel.json`, `package.json` — entrada de deploy da Vercel.
- `cloud-backend/test-cloud.mjs` — testes contratuais com armazenamento simulado.
- `central-ia.html`, `central-ia.js` — endereço da Central agora configurável (local ou HTTPS).
- `ai-assistant.js` — geração da IA Coringa utiliza o endereço e o token da Central salva.
- `manifest.json` — versão 1.4.1.
- `ia-server/` — serviço local original preservado.
