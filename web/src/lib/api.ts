import ApiInstance from "./axios";
import type { DocumentField, GetAllDocsResponse, GetDocResponse, GetDocsParams, SigningSessionResponse } from "@/types";

// Get all documents with pagination and filtering
export async function getDocs(params?: GetDocsParams): Promise<GetAllDocsResponse> {
    const response = await ApiInstance.get<GetAllDocsResponse>("/api/docs", { params });
    return response.data;
}

// Get a single document by ID (requires auth)
export async function getDoc(id: string): Promise<GetDocResponse> {
    const response = await ApiInstance.get<GetDocResponse>(`/api/docs/${id}`);
    return response.data;
}

// Create a new document (multipart form)
export async function createDoc(formData: FormData): Promise<{ success: boolean }> {
    const response = await ApiInstance.post("/api/docs", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
}

// Delete a document
export async function deleteDoc(id: string): Promise<{ success: boolean }> {
    const response = await ApiInstance.delete(`/api/docs/${id}`);
    return response.data;
}

// View document publicly (no auth required)
export async function viewDoc(id: string): Promise<GetDocResponse> {
    const response = await ApiInstance.get<GetDocResponse>(`/api/docs/view/${id}`);
    return response.data;
}

// Sign a document (multipart form, no auth required)
export async function signDoc(
    id: string,
    formData: FormData
): Promise<{ success: boolean }> {
    const response = await ApiInstance.post(`/api/docs/sign/${id}`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
}

// Get the base URL for static file paths
export function getFileUrl(path: string): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    return new URL(path.replaceAll("\\", "/"), baseUrl).toString();
}

export async function createSigningSession(id: string, expiryHours = 168): Promise<{ session: SigningSessionResponse["session"]; token: string; url: string }> {
    const response = await ApiInstance.post(`/api/docs/${id}/signing-sessions`, { expiryHours });
    return response.data.data;
}

export async function getSigningSession(token: string): Promise<{ data: SigningSessionResponse; success: boolean }> {
    const response = await ApiInstance.get(`/api/signing-sessions/${token}`);
    return response.data;
}

export async function completeSigningSession(token: string, payload: {
    signerName: string;
    remarks: string;
    signature: { type: "drawn" | "uploaded"; imageData: string };
    fields: { fieldId: string; value: string }[];
}): Promise<{ success: boolean }> {
    const response = await ApiInstance.post(`/api/signing-sessions/${token}/complete`, payload);
    return response.data;
}

export async function replaceDocumentFields(id: string, fields: DocumentField[]): Promise<{ success: boolean }> {
    const response = await ApiInstance.put(`/api/docs/${id}/fields`, fields);
    return response.data;
}

export async function getDocumentFields(id: string): Promise<{ data: DocumentField[]; success: boolean }> {
    const response = await ApiInstance.get(`/api/docs/${id}/fields`);
    return response.data;
}
