// API Response Types

export interface Document {
    id: string;
    title: string;
    description: string;
    tags: string[];
    originalName: string;
    originalPath: string;
    signedName?: string;
    signedPath?: string;
    isSigned: boolean;
    signedAt?: string;
    signedByMetadata?: string;
    signedByIp?: string;
    ipWhitelist: string[];
    remarks?: string;
    deleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface GetAllDocsResponse {
    data: {
        limit: string;
        page: string;
        total: number;
        docs: Document[];
    };
    success: boolean;
}

export interface GetDocResponse {
    data: Document;
    success: boolean;
}

export interface LoginResponse {
    data: {
        token: string;
    };
    success: boolean;
}

export interface ErrorResponse {
    message: string;
    success: false;
}

export interface GetDocsParams {
    page?: number;
    limit?: number;
    keyword?: string;
    signed?: "true" | "false";
}

export interface DocumentField {
    id: string;
    documentId: string;
    type: "signature" | "name" | "date" | "text";
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
    label?: string;
}

export interface SigningSessionResponse {
    session: { id: string; documentId: string; status: string; expiresAt: string };
    document: { id: string; title: string; description: string; originalPath: string; originalName: string };
    fields: DocumentField[];
}
