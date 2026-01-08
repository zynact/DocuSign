# Inkra <img src="/web/public/inkra.svg" width="24">
A self-hosted, privacy-first PDF signing platform that lets clients sign contracts directly in the browser. No
downloads, no third-party tools.

## Why?

In freelancing or when taking up contract works there is a needs for the client to sign a contract agreement. This is
usually done by sending them a mail, and they sign the pdf and send it back. One issue with this approach is, the client
might not be technically skilled. Some clients download, take the printout and then physically sign and then scan those
papers and send them back. Some download and upload this pdf to a 3rd party signing website, which is a privacy issue.

Inkra solves this problem by letting the client sign the contract directly in the browser.
As a developer:

- You upload the contract
- Generate a public signing link
- Share it with the client
- Client signs and submits - Done!

No accounts, no installs, no external services.

---

## Features

- Sign PDFs directly in the browser
- Shareable public signing links
- Privacy-first (fully self-hosted)
- No downloads required for the client
- Easy Docker-based deployment
- Fast and lightweight

---

## Tech Stack

- Go lang
- Chi (https://go-chi.io/)
- SQLite
- React (vite + ts)
- pdf.js viewer (https://mozilla.github.io/pdf.js/web/viewer.html)

---

## Deployment

### Docker

This is the easiest and recommended way to run Inkra.

#### Prerequisites

- Docker
- Docker Compose

#### Steps

##### 1. Clone the repo

```bash
git clone https://github.com/fbn776/Inkra
cd inkra
```

##### 2. Fill in the environment variables

Create `.env` file in the root directory and fill in the following variables:

```dotenv
JWT_SECRET=
# Email
ADMIN_USERNAME=
ADMIN_PASSWORD=
PORT=
```

##### 3. Build the docker image

```bash
docker compose up -d --build
```

Now the app should be running on `PORT` specified in the `.env` file.

##### 4. Login

The admin username and password are specified in the `.env` file.
You can login to the admin panel using the credentials.

### Manual

#### Prerequisites

- Go lang
- Node.js

#### Steps

##### 1. Clone the repo

```bash
git clone https://github.com/fbn776/Inkra
cd inkra
```

##### 2. Fill in the environment variables

Create `.env` file in the root directory and fill in the following variables:

```dotenv
JWT_SECRET=
# Email
ADMIN_USERNAME=
ADMIN_PASSWORD=
PORT=
```

##### 3. Build the frontend and create database store 

```bash
mkdir data

cd web
npm install
npm run build
```

##### 4. Run the backend

```bash
go mod tidy
go run .
```

If you want to build the binary, run `go build . -o inkra` and then run the binary `./inkra`.

Now the app should be running on `PORT` specified in the `.env` file.
Login to the admin panel using the credentials in env.





---

## Usage Flow

- Login to the admin panel
- Upload a PDF contract
- Click on the uploaded pdf and copy the public url
- Share the link with the client
- Client signs directly in the browser
- Signed PDF is stored securely on your server

---

> ⚠️ Inkra is not a legal substitute for certified digital signature providers.
Use it for lightweight agreements, internal contracts, or trust-based workflows.