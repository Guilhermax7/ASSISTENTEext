# Sra. Luck — FreeLLMAPI único

Backend de Vercel com uma conexão FreeLLMAPI. As chaves de Groq, Ollama e outros provedores permanecem exclusivamente dentro do FreeLLMAPI. A Sra. Luck armazena somente a chave unificada, criptografada, e o roteamento dos perfis de Cobrança e Atendimento.

**Hospedagem:** Vercel com Root Directory `cloud-backend`. Configure no painel da Vercel: `DATABASE_URL` de Postgres (por exemplo Neon), `SRA_LUCK_MASTER_KEY`, `SRA_LUCK_ADMIN_TOKEN`, `SRA_LUCK_ALLOWED_EXTENSION_ORIGINS` e `SRA_LUCK_ALLOWED_EXTERNAL_HOSTS`. Nunca versione valores reais.

**Conexão:** o FreeLLMAPI remoto precisa responder por HTTPS privado/autenticado em `/v1/models?execution_status=ready` e `/v1/chat/completions`. `127.0.0.1:31415` só funciona na máquina local e não pode ser alcançado pela Vercel. Não exponha a porta desktop diretamente à internet.

**Custo:** `free_only` começa ativado e bloqueia chamadas remotas até verificação de gratuidade. Estado `ready` não é evidência de custo zero.

**Fallback:** deixe `auto`, `auto:fast`, `auto:smart` ou `auto:reliable` no FreeLLMAPI; o backend Sra. Luck não cria outro fallback.

**Segurança:** autenticação administrativa, criptografia AES-GCM das credenciais em banco, destinos remotos permitidos por allowlist, resolução DNS verificada, limites de tamanho/tempo e consentimento explícito para envio de mensagens.

**Estado de entrega:** integração preparada. Sem banco, credenciais técnicas e endpoint FreeLLMAPI remoto não há conexão real nem modelos confirmados.
