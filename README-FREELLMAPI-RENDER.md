# FreeLLMAPI hospedado — piloto para a Sra. Luck

> **Status:** infraestrutura preparada para teste, sem instância Render criada e sem conexão com modelos reais. Não utilizar para dados de clientes. O FreeLLMAPI oficial descreve seu uso como **experimentação pessoal**, não produção comercial. Antes de utilizar na empresa, valide termos de cada provedor e requisitos LGPD, controle de acesso e retenção de dados.

## Arquitetura

- **Sra. Luck** (Vercel): https://assistenteext.vercel.app/central-ia.html
- **Backend da Central** (Vercel): https://assistenteext-ia.vercel.app
- **FreeLLMAPI** (Render, novo serviço): https://NOME-DO-SERVICO.onrender.com/v1
- **Neon existente**: estado da Central e backup *já criptografado pelo próprio FreeLLMAPI*.

A instalação Render não precisa de CMD no computador. Mas **Render Free não funciona continuamente**: hiberna após 15 minutos ocioso, pode demorar ~1 minuto para iniciar e perde seu armazenamento local após desligamentos/redeploys. A alternativa de backup indicada abaixo é essencial. Para serviço realmente sempre ativo e controle de dados, use VM com volume persistente (ex.: Oracle Cloud Always Free quando elegível; exige conta, configuração e não oferece garantia de disponibilidade).

## Como implantar no Render (piloto)

1. Autorize a conexão Render no ChatGPT para implantação assistida, **ou** abra https://dashboard.render.com/blueprints e conecte o GitHub `Guilhermax7/ASSISTENTEext`. O arquivo `render.yaml` cria **um único Web Service Free**, usando a imagem oficial FreeLLMAPI `v0.16.11`.
2. Configure os segredos solicitados pelo Blueprint exclusivamente no Render:
   - `ENCRYPTION_KEY`: **64 caracteres hexadecimais** gerados com CSPRNG. Mantenha estável para que as chaves da API possam ser descriptografadas depois.
   - `FREEAPI_DB_BACKUP_KEY`: **outros 64 caracteres hexadecimais**, também estáveis.
   - `FREEAPI_DB_BACKUP_TOKEN`: token secreto aleatório exclusivo de 32 caracteres ou mais, igual ao valor da variável `SRA_LUCK_FREELLMAPI_BACKUP_TOKEN` na Vercel. Deve ser criado após a infraestrutura de backup estar testada.
3. No projeto Vercel `assistenteext-ia`, configure `SRA_LUCK_FREELLMAPI_BACKUP_TOKEN` **somente em Production**, com o mesmo valor de `FREEAPI_DB_BACKUP_TOKEN` do Render, como variável `sensitive` ou `encrypted`. Faça redeploy e confira que GET em `/api/backup` com token correto retorna 404 caso não exista backup.
4. Render: configure `FREEAPI_DB_BACKUP_URL=https://assistenteext-ia.vercel.app/api/backup` (já no Blueprint). Esta URL aceita GET para restaurar, PUT para guardar. O arquivo binário é **criptografado na origem pelo FreeLLMAPI**; o serviço não precisa descriptografá-lo. Cada backup substitui o anterior e o limite é **3 MB por backup**.
5. Consulte `https://NOME-DO-SERVICO.onrender.com/api/ping` para verificar se Render foi ativado. Crie a conta administrativa do FreeLLMAPI no dashboard usando o código de primeiro acesso dos logs do servidor; escolha credenciais fortes.
6. A instalação remota começa **sem** chaves dos provedores do seu computador. Não há migração automática para a nuvem. A documentação oficial descreve como copiar a pasta/SQLite com os dados do Desktop para outra instalação, mas o processo exige acesso aos arquivos locais e configuração correta da criptografia. Alternativamente, recadastre as chaves **somente no painel FreeLLMAPI remoto**, não na Central Sra. Luck. Não envie chaves no GitHub ou neste chat.
7. No projeto Vercel `assistenteext-ia`, crie `SRA_LUCK_ALLOWED_EXTERNAL_HOSTS=NOME-DO-SERVICO.onrender.com`, sem `https://`, sem `/v1`. Faça redeploy.
8. Em `https://assistenteext.vercel.app/central-ia.html`, conecte com o Admin Token existente. Cadastre **uma conexão FreeLLMAPI** com URL `https://NOME-DO-SERVICO.onrender.com/v1` e a chave unificada gerada pelo FreeLLMAPI remoto. Descubra modelos e configure `auto` (se oferecido pelo serviço). Chaves individuais continuam no FreeLLMAPI.
9. Para testes de integração, use exclusivamente mensagens fictícias. A política `free_only` bloqueia a geração externa por padrão; não a desligue antes de validar custos, termos e autorização para o envio externo.

## Restrições / segurança

- **Não expor** `127.0.0.1:31415`, `ENCRYPTION_KEY`, `FREEAPI_DB_BACKUP_KEY` nem a chave unificada ao público.
- O FreeLLMAPI é **single-user**: funcionárias não devem receber a senha de administração ou a chave unificada. O atual Admin Token da Central também é privilegiado e não é apropriado para distribuir à equipe; antes do uso multiusuário, precisa de autenticação individual e permissões limitadas.
- **Dados sensíveis:** a Sra. Luck lida com dados financeiros e possíveis dados de saúde. Restrinja o piloto a dados sintéticos e obtenha avaliação de segurança e privacidade antes de qualquer uso real.
- Render Free e os níveis gratuitos dos provedores **não garantem** disponibilidade 24 horas, tempo de resposta, gratuidade ilimitada nem adequação para uso comercial.
- O backup contém credenciais cifradas e configuração do FreeLLMAPI; trate-o como segredo, mantenha as chaves de criptografia estáveis e planeje rotação/recuperação.
- Quando `/api/backup` retorna `503 BACKUP_NOT_CONFIGURED`, a variável Vercel ainda falta; `404 NO_BACKUP` com autenticação válida significa que ainda não houve upload inicial.
- O limite de 3 MB é intencional para respeitar tamanho de payload da função Vercel. Monitore; se o banco do FreeLLMAPI superar o limite, interrompa o piloto e migre backup para armazenamento adequado antes de confiar no serviço.

## Fontes

- Projeto oficial: https://github.com/tashfeenahmed/freellmapi
- Implantação: https://github.com/tashfeenahmed/freellmapi/blob/main/docs/en/deployment/01-docker.md
- Render Free: https://render.com/docs/free
- Blueprint Render: https://render.com/docs/blueprint-spec
- Oracle Always Free: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
