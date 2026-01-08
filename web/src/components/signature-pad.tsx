import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Upload, Pencil } from "lucide-react";

export interface SignaturePadRef {
    isEmpty: () => boolean;
    getDataUrl: () => string;
    clear: () => void;
}

interface SignaturePadProps {
    onChange?: (hasSignature: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
    ({ onChange }, ref) => {
        const canvasRef = useRef<SignatureCanvas>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const [mode, setMode] = useState<"draw" | "upload">("draw");
        const [uploadedImage, setUploadedImage] = useState<string | null>(null);

        useImperativeHandle(ref, () => ({
            isEmpty: () => {
                if (mode === "upload") {
                    return !uploadedImage;
                }
                return canvasRef.current?.isEmpty() ?? true;
            },
            getDataUrl: () => {
                if (mode === "upload" && uploadedImage) {
                    return uploadedImage;
                }
                return canvasRef.current?.toDataURL("image/png") || "";
            },
            clear: () => {
                canvasRef.current?.clear();
                setUploadedImage(null);
                onChange?.(false);
            },
        }));

        const handleClear = () => {
            canvasRef.current?.clear();
            setUploadedImage(null);
            onChange?.(false);
        };

        const handleEnd = () => {
            const isEmpty = canvasRef.current?.isEmpty() ?? true;
            onChange?.(!isEmpty);
        };

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setUploadedImage(event.target?.result as string);
                    onChange?.(true);
                };
                reader.readAsDataURL(file);
            }
        };

        return (
            <div className="space-y-3">
                {/* Mode Toggle */}
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant={mode === "draw" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMode("draw")}
                        className="gap-2"
                    >
                        <Pencil className="h-4 w-4" />
                        Draw
                    </Button>
                    <Button
                        type="button"
                        variant={mode === "upload" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMode("upload")}
                        className="gap-2"
                    >
                        <Upload className="h-4 w-4" />
                        Upload
                    </Button>
                </div>

                {/* Canvas or Upload Area */}
                {mode === "draw" ? (
                    <div className="border-2 border-dashed rounded-lg bg-white relative">
                        <SignatureCanvas
                            ref={canvasRef}
                            canvasProps={{
                                className: "w-full h-40 rounded-lg",
                                style: { width: "100%", height: "160px" },
                            }}
                            penColor="#000000"
                            onEnd={handleEnd}
                        />
                        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground pointer-events-none">
                            Draw your signature above
                        </p>
                    </div>
                ) : (
                    <div
                        className="border-2 border-dashed rounded-lg bg-white p-4 text-center cursor-pointer hover:border-primary/50 transition-colors h-40 flex items-center justify-center"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {uploadedImage ? (
                            <img
                                src={uploadedImage}
                                alt="Signature"
                                className="max-h-full max-w-full object-contain"
                            />
                        ) : (
                            <div className="space-y-2">
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Click to upload signature image
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Clear Button */}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="gap-2"
                >
                    <Eraser className="h-4 w-4" />
                    Clear
                </Button>
            </div>
        );
    }
);

SignaturePad.displayName = "SignaturePad";
