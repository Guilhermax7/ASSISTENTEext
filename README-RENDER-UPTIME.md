# Disponibilidade do FreeLLMAPI na Render Free

## O que foi configurado
O arquivo `.github/workflows/render-uptime.yml` cria uma tarefa do GitHub Actions que tenta consultar o endpoint público
`https://sra-luck-freellmapi.onrender.com/api/ping` **a cada 5 minutos**, sem chave de API e sem enviar conteúdo de clientes. A rota retorna `{"status":"ok", ...}` quando o FreeLLMAPI responde.

O objetivo é reduzir o período sem tráfego que leva a Render Free a entrar em modo de espera (15 minutos).
A rotina é independente do computador local e não gera implantações na Vercel.

## Importante: NÃO é disponibilidade 24/7 garantida
- GitHub Actions `schedule` é **best effort**; pode atrasar, ser descartado e, em repositórios públicos sem atividade por 60 dias, ser desativado.
- Render Free pode reiniciar ou suspender serviços por manutenção, limite de horas gratuitas, banda, política da plataforma ou recursos. Mesmo recebendo consultas, isso **não garante uptime**.
- Render oferece **750 horas de serviço gratuito por workspace/mês**; deixar mais de um serviço Free ativo pode consumir a cota e provocar suspensão.
- O plano Free não é adequado para operação comercial/produção com dados sensíveis.
- Não adicionamos tokens nem credenciais: a rota `/api/ping` é pública e usa apenas GET.
- Se o GitHub Actions mostrar falha, examine a página de execuções e o painel da Render. Não desative a proteção por autenticação das demais rotas.

## Verificar funcionamento
1. Abra https://github.com/Guilhermax7/ASSISTENTEext/actions/workflows/render-uptime.yml
2. Verifique a execução mais recente ou use **Run workflow** para testar imediatamente.
3. Os logs devem mostrar `FreeLLMAPI respondeu status=ok.` e execução concluída.
4. Monitore o uso em https://dashboard.render.com/web/srv-dbh3rkvf3r2c73er3t40 e na página de Billing.

## Como desativar
Em GitHub → Actions → `Verificação do FreeLLMAPI na Render` → menu (…) → **Disable workflow**.
Isso faz o Render voltar a hibernar naturalmente quando não houver visitas.

## Falha na Central mesmo com Playground funcional
A verificação de disponibilidade não corrige por si só erros de comunicação entre o backend Sra. Luck/Vercel e o FreeLLMAPI. O usuário confirmou que o Playground respondeu; portanto, primeiro valide a implantação da correção da API no projeto `assistenteext-ia`, após a liberação da cota de builds da Vercel.
