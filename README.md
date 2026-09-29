# Live Diversa — landing page em HTML

A página está em [`index.html`](./index.html), com estilos em [`styles.css`](./styles.css) e interação do popup e contador em [`app.js`](./app.js). Abra `index.html` diretamente no navegador para revisar o visual. O popup abre com Nome, E-mail e WhatsApp; a prévia mostra um aviso e não envia dados.

A imagem enviada para o fundo discreto do hero está em [`assets/eleicoes-hero-background.jpeg`](./assets/eleicoes-hero-background.jpeg). Seu tom azul e opacidade são aplicados no CSS, sem alterar o arquivo original. Para outra live, substitua esse asset e confira o recorte no desktop e no celular.

## Ativar o cadastro

O formulário só pode confirmar cadastros quando um serviço externo guardar os contatos **e programar o aviso no início da live**. Configure `LEAD_WEBHOOK_URL` no ambiente e execute `node server.mjs` (Node 20+). Abra `http://localhost:4173/`. Se necessário, defina `LEAD_WEBHOOK_TOKEN` para autenticar o POST.

O webhook recebe `event`, `eventDateTime`, `name`, `email`, `whatsapp` (formato 55 + DDD + número), `consent`, `source` e `createdAt`. Uma resposta HTTP 2xx confirma a entrega. Sem webhook, o popup continua disponível para revisar os campos, mas o botão de envio fica desativado e explica a indisponibilidade antes de solicitar dados.

## Publicação e próximas lives

Antes de publicar, defina a URL pública no `canonical`, `og:url` e `og:image` de `index.html`; confira os links sociais e o texto legal. Para outro evento, edite o conteúdo de `index.html`, as datas em `window.__EVENT__` nesse arquivo e os metadados de `event-config.mjs` usados pelo webhook.
