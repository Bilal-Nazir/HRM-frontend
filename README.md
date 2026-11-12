# Be My Admin Frontend

Standalone Next.js frontend: <https://github.com/saqibVentures/BeMyAdmin-frontEnd>.
The backend stays in its own repository and is accessed over HTTP. No backend
source files, database configuration, or backend secrets are required here.

## Backend connection

The deployed backend base URL is **`https://3.126.250.133/api`**.
Check it at <https://3.126.250.133/api/health>.

Set `NEXT_PUBLIC_API_URL` to change the backend. Include the `/api` prefix for the
existing AWS reverse proxy; a directly exposed backend may use its domain root.
Do not include an endpoint such as `/auth/login` or `/health` in the base URL.
Trailing slashes are normalized. `/api` remains supported for a same-origin proxy.

This is a public browser setting, not a secret. Next.js embeds it at **build time**,
so rebuild when changing it. HTTPS frontends must connect to an HTTPS backend.
The backend must allow the frontend's origin through its CORS configuration.

## Local development

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Open <http://localhost:3000>. The example uses a local backend at
`http://localhost:8080`. To use the deployed backend, change `.env.local` to:

```dotenv
NEXT_PUBLIC_API_URL=https://3.126.250.133/api
```

Restart the dev server after changing this value. `.env.local` is ignored by Git.

## Independent hosting

### Cloudflare Workers

The committed `wrangler.jsonc` and `open-next.config.ts` configure OpenNext for
the existing Worker **`bemyadmin-frontend`**. `WORKER_SELF_REFERENCE` must target
that same Worker name. Keep these names aligned if the Worker is renamed.

In Workers Builds, use `npm run deploy` as the deploy command and leave the
separate build command empty (the deploy script performs the build). Replace the
old `npx wrangler deploy` command, which relied on interactive framework setup.
Set `NEXT_PUBLIC_API_URL=https://3.126.250.133/api` in build variables.
No R2 bucket or Cloudflare Images resource is required by this frontend.

```sh
npm run build:cloudflare  # Next.js build plus Workers bundle
npm run preview           # Preview in the Workers runtime
npm run deploy            # Build and deploy with existing Cloudflare credentials
```

The Next.js build writes `.next`; OpenNext then generates `.open-next/worker.js`
and `.open-next/assets`. These generated directories are ignored by Git. Configure
the adapter in source control rather than running an automatic migration during
every deployment.

### Other Next.js hosts

On a Next.js host, import this repository, choose `main`, and set
`NEXT_PUBLIC_API_URL=https://3.126.250.133/api` before building. Use `npm run build`
as the build command. The production default is the same deployed backend address.

For a local production build, `.env.local` takes precedence, so set the intended
backend there or supply the environment variable explicitly:

```sh
NEXT_PUBLIC_API_URL=https://3.126.250.133/api npm run build
```

For Docker, use the standalone frontend image without checking out the backend:

```sh
docker build --build-arg NEXT_PUBLIC_API_URL=https://3.126.250.133/api -t bemyadmin-frontend .
docker run --rm -p 3000:3000 bemyadmin-frontend
```

## Authentication

Protected pages stay hidden until the backend validates the session. The frontend
uses `GET /auth/session` when available. Older backends that return 404 for this
endpoint are supported through `POST /auth/refresh`, which checks the active user
and issues a fresh access token. Rejected sessions require signing in again;
network failures keep protected content hidden and offer a retry.

## Checks and deployment

```sh
node --test tests/*.test.mjs
npm run build
```

Pushes and pull requests to `main` run frontend tests and a Cloudflare production build.
The optional AWS deployment workflow runs on `prod` or manual dispatch and needs
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS` secrets.
Set the repository variable `NEXT_PUBLIC_API_URL` to override the backend address
in either workflow. Pushing `main` does not deploy to the existing AWS server.
