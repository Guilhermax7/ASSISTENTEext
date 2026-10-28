# Sra. Luck — backend FreeLLMAPI na nuvem

A extensão do Chrome continua com Carteira, Templates e Simulações. A nova Central de IA funciona no backend `cloud-backend`, persistindo em PostgreSQL (Neon ou compatível).

Para publicar use **Root Directory = cloud-backend** no projeto Vercel da Central. Configure na Vercel `DATABASE_URL`, `SRA_LUCK_MASTER_KEY`, `SRA_LUCK_ADMIN_TOKEN`, `SRA_LUCK_ALLOWED_EXTENSION_ORIGINS` e `SRA_LUCK_ALLOWED_EXTERNAL_HOSTS`. Consulte [README-FREELLMAPI.md](README-FREELLMAPI.md) e [cloud-backend/.env.example](cloud-backend/.env.example). **Não publique chaves no GitHub**.

A única conexão da Central será **FreeLLMAPI**; suas chaves de Groq, Gemini e outros permanecem no FreeLLMAPI. A chave unificada FreeLLMAPI só é cadastrada pelo painel da Sra. Luck e gravada criptografada no banco, nunca retornada pela API.

O FreeLLMAPI Desktop em `127.0.0.1:31415` **não é acessível pela Vercel**. Precisará de uma instância remota via HTTPS autenticado, não de portas públicas improvisadas. `ready` não é confirmação de gratuidade; `free_only` bloqueia geração externa até configuração explícita.

**Status:** código preparado em branch de teste; produção não deve ser trocada antes das credenciais, do banco e da verificação de uma conexão FreeLLMAPI real.
