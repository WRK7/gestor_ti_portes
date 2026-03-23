# API (back-end)

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste. Principais:

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Chave forte para assinar JWT de acesso |
| `JWT_ACCESS_EXPIRES_IN` | Expiração do access token (ex.: `15m`) |
| `JWT_REFRESH_EXPIRES_DAYS` | Validade do refresh (cookie HttpOnly) |
| `CORS_ORIGINS` | Origens permitidas (vírgula). Inclua a URL exata do front (ex.: `http://10.100.20.137:5292`) se não usar LAN automática |
| `CORS_ALLOW_LAN` | `true`: aceita origens em IPs de rede privada (10/8, 192.168/16, 172.16–31). Em `NODE_ENV=production` use `true` ou liste em `CORS_ORIGINS` |
| `COOKIE_SECURE` | `true` se a API for servida só por HTTPS |
| `COOKIE_SAMESITE` | `lax` (padrão) ou `none` se front e API forem domínios diferentes em HTTPS |
| `REVOKE_REFRESH_ON_LOGIN` | `true` para invalidar outras sessões ao logar |

## Primeiro administrador (sem seed fixo no SQL)

Não há mais usuário admin embutido na migration. Após subir o banco e rodar o servidor (migrations), crie o admin **uma vez**:

```bash
# No .env:
# ADMIN_USERNAME=seu.usuario
# ADMIN_PASSWORD=SenhaForte123!
# ADMIN_EMAIL=opcional@email.com
# ADMIN_NAME=Nome Exibido
# ADMIN_ROLE=superadmin   # ou admin

npm run bootstrap:admin
```

Se o usuário já existir, o script não altera nada.

## Autenticação

- **Access token (JWT)**: curta duração, enviado no header `Authorization` (o front guarda só em memória).
- **Refresh token**: cookie **HttpOnly** `refresh_token` no path `/api/auth` (não acessível via JavaScript).
- Endpoints: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.

O front-end deve usar `withCredentials: true` nas requisições à API.

**Erro de CORS no navegador (“No Access-Control-Allow-Origin”)**  
O back-end só envia esse header para origens permitidas. Com front em outra porta/IP (ex.: `http://10.100.20.137:5292` e API em `:3847`), adicione essa URL em `CORS_ORIGINS` **ou** use `CORS_ALLOW_LAN=true` em produção na LAN. Reinicie o servidor após alterar o `.env`.
