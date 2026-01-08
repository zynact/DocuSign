import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { createDoc } from "@/lib/api";
import { Upload, Loader2, X, FileUp } from "lucide-react";

const uploadSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    tags: z.string().optional(),
    ipWhitelist: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface UploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<UploadFormData>({
        resolver: zodResolver(uploadSchema),
    });

    const uploadMutation = useMutation({
        mutationFn: async (data: UploadFormData) => {
            if (!file) throw new Error("Please select a PDF file");

            const formData = new FormData();
            formData.append("title", data.title);
            if (data.description) formData.append("description", data.description);
            if (data.tags) formData.append("tags", data.tags);
            if (data.ipWhitelist) formData.append("ipWhitelist", data.ipWhitelist);
            formData.append("file", file);

            return createDoc(formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["docs"] });
            reset();
            setFile(null);
            onOpenChange(false);
        },
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === "application/pdf") {
                setFile(droppedFile);
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const onSubmit = (data: UploadFormData) => {
        uploadMutation.mutate(data);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Upload Document
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Upload a PDF document to generate a shareable signing link.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* File Drop Zone */}
                    <div
                        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
                                ? "border-primary bg-primary/5"
                                : file
                                    ? "border-green-500 bg-green-500/5"
                                    : "border-border hover:border-muted-foreground"
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {file ? (
                            <div className="flex items-center justify-center gap-2">
                                <FileUp className="h-5 w-5 text-green-500" />
                                <span className="text-sm font-medium">{file.name}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Drop a PDF here or click to browse
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            {...register("title")}
                            placeholder="Document title"
                        />
                        {errors.title && (
                            <p className="text-sm text-destructive">{errors.title.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            {...register("description")}
                            placeholder="Optional description"
                            rows={2}
                        />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <Label htmlFor="tags">Tags</Label>
                        <Input
                            id="tags"
                            {...register("tags")}
                            placeholder="contract, client, 2024 (comma separated)"
                        />
                    </div>

                    {/* IP Whitelist */}
                    <div className="space-y-2">
                        <Label htmlFor="ipWhitelist">IP Whitelist</Label>
                        <Input
                            id="ipWhitelist"
                            {...register("ipWhitelist")}
                            placeholder="192.168.1.1, 10.0.0.1 (comma separated, leave empty for any)"
                        />
                        <p className="text-xs text-muted-foreground">
                            Only these IPs can view the document. Leave empty to allow all.
                        </p>
                    </div>

                    {uploadMutation.isError && (
                        <p className="text-sm text-destructive">
                            {uploadMutation.error instanceof Error
                                ? uploadMutation.error.message
                                : "Upload failed. Please try again."}
                        </p>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel type="button" disabled={uploadMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <Button type="submit" disabled={uploadMutation.isPending || !file}>
                            {uploadMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload
                                </>
                            )}
                        </Button>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
