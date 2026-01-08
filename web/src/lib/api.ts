import ApiInstance from "./axios";
import type { GetAllDocsResponse, GetDocResponse, GetDocsParams } from "@/types";

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
    console.log("Base URL:", baseUrl);
    return new URL(path, baseUrl).toString();
}
