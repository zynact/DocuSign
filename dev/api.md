# API Docs

Generally errors are returned with
```ts
interface ErrorResponse {
    "message": string
    "success": false
}
```

The paths such as `originalPath` and other paths are statically served from the same api

If error, then status code will be 400 to 500 range

## Auth

### POST /api/login

Body:
```json
{
  "email": "<EMAIL>",
  "password": "<PASSWORD>"
}
```

Returns:

```ts
interface LoginResponse {
    data: {
        token: string
    },
    success: boolean
}
```

## Docs

### GET /api/docs
(Needs token)

Gets all documents (pdfs)

Params:
- `page`: Page number
- `limit`: No of documents to get
- `keyword`: Keyword to search for
- `signed`: `1` (true) or `0` (false)

Returns:

JSON of the form:
```ts
interface GetAllDocsResponse {
    data: {
        limit: string,
        page: string,
        total: number,
        docs: {
            id: string,
            title: string,
            description: string,
            tags: string[],
            originalName: string,
            originalPath: string,
            signedName?: string,
            signedPath?: string,
            isSigned: boolean,
            signedAt?: string,
            signedByMetadata?: string,
            signedByIp?: string,
            ipWhitelist: string[],
            remarks?: string,
            deleted: boolean,
            createdAt: string,
            updatedAt: string
        }[]
    },
    success: boolean,
}
```

### GET /api/docs/:id
(Needs token)
Get one doc by id

Returns:

JSON of the form:
```ts
interface GetAllDocsResponse {
    data: {
        limit: string,
        page: string,
        total: number,
        docs: {
            id: string,
            title: string,
            description: string,
            tags: string[],
            originalName: string,
            originalPath: string,
            signedName?: string,
            signedPath?: string,
            isSigned: boolean,
            signedAt?: string,
            signedByMetadata?: string,
            signedByIp?: string,
            ipWhitelist: string[],
            remarks?: string,
            deleted: boolean,
            createdAt: string,
            updatedAt: string
        }
    },
    success: boolean,
}
```

### POST /api/docs
(Needs token)
Create document

This takes in multipart form of the following structure:

- `title` - Name of the document
- `description` - Description of the document
- `tags` - Tags of the document (comma separated)
- `ipWhitelist` - IPs to be whitelisted (comma seperated)
- `file` - Binary file (only pdf is allowed)

### DELETE /api/docs/:id
(Needs token)
Deletes the document


### GET /api/docs/view/:id
(No token needed)

Returns:

JSON of the form:
```ts
interface GetAllDocsResponse {
    data: {
        limit: string,
        page: string,
        total: number,
        docs: {
            id: string,
            title: string,
            description: string,
            tags: string[],
            originalName: string,
            originalPath: string,
            signedName?: string,
            signedPath?: string,
            isSigned: boolean,
            signedAt?: string,
            signedByMetadata?: string,
            signedByIp?: string,
            ipWhitelist: string[],
            remarks?: string,
            deleted: boolean,
            createdAt: string,
            updatedAt: string
        }
    },
    success: boolean,
}
```


### POST /api/docs/sign/:id
(No token needed)
Signs the document

This takes in multipart form of the following structure:
- `remarks` - Remarks to be added
- `metadata` - Metadata to be added
- `file` - Binary doc that is signed (only pdf is allowed)