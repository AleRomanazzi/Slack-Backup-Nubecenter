# Slack Backup Viewer (Nubecenter)

Webapp en Next.js para visualizar el backup exportado de Slack (formato JSON nativo), enfocada en el canal `despliegue-openstack`.

## Requisitos

- Node.js 20+ recomendado
- npm 10+
- Tener esta estructura de carpetas:
  - Proyecto Next.js en `slack-backup-viewer/`
  - Export de Slack en `Nubecenter Slack export Mar 17 2026 - Apr 16 2026/`

La app resuelve los datos desde filesystem usando esta ruta esperada (relativa a la raiz del proyecto):

`./Nubecenter Slack export Mar 17 2026 - Apr 16 2026`

## Ejecutar en local

```bash
npm install
npm run prisma:generate
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Configurar login admin con Neon

1. Copiar variables:

```bash
cp .env.example .env
```

2. Editar `DATABASE_URL` y `AUTH_SECRET` en `.env`.

3. Crear tablas y seed inicial del admin:

```bash
npm run prisma:migrate -- --name init_auth
npm run prisma:seed
```

Credenciales iniciales:
- usuario: `admin`
- password: `NubeCenter.2026` (o valor de `ADMIN_PASSWORD` en `.env`)

## Funcionalidades implementadas (V1)

- Vista tipo Slack con sidebar + timeline de mensajes.
- Parseo de:
  - `channels.json`
  - `users.json`
  - archivos diarios de `despliegue-openstack/*.json`
- Resolucion de menciones `<@USER_ID>` a `@Nombre`.
- Render de reacciones con contador.
- Búsqueda por texto (`q`) con resaltado de coincidencias.
- Login admin con sesión segura y rutas protegidas.
- Base de accesibilidad:
  - contraste alto,
  - foco visible,
  - etiquetas/landmarks semanticos,
  - navegacion por teclado.

## Scripts utiles

```bash
npm run lint
npm run build
npm run prisma:generate
npm run prisma:migrate -- --name init_auth
npm run prisma:seed
```

## Notas

- Los canales `social` y `all-nubecenter` se excluyen del sidebar por configuración.
