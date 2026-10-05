import {useEffect, useRef, useState} from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {Button} from "@/components/ui/button";
import type {DocumentField} from "@/types";

// Bundle the worker from the same pdfjs-dist package as the API. PDF.js
// rejects workers from a different version.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfFieldEditorProps {
    fileUrl: string;
    initialField: DocumentField;
    onSave: (field: DocumentField) => void;
    saving?: boolean;
}

export function PdfFieldEditor({fileUrl, initialField, onSave, saving = false}: PdfFieldEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const [pageNumber, setPageNumber] = useState(initialField.pageNumber);
    const [pageCount, setPageCount] = useState(1);
    const [pageSize, setPageSize] = useState({width: 612, height: 792});
    const [field, setField] = useState(initialField);
    const [drag, setDrag] = useState<{mode: "move" | "resize"; startX: number; startY: number; field: DocumentField} | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setField(initialField);
        setPageNumber(initialField.pageNumber);
    }, [initialField]);

    useEffect(() => {
        let cancelled = false;
        const loadPage = async () => {
            try {
                // Do not send Authorization headers to the static file server.
                // That would trigger a CORS preflight in dev/tunnel environments.
                const response = await fetch(fileUrl, {credentials: "same-origin"});
                if (!response.ok) throw new Error(`PDF request failed with HTTP ${response.status}`);
                const contentType = response.headers.get("content-type") || "";
                if (!contentType.includes("pdf")) throw new Error(`Expected PDF but received ${contentType || "unknown content"}`);
                const pdf = await pdfjsLib.getDocument({data: new Uint8Array(await response.arrayBuffer())}).promise;
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({scale: 1.5});
                if (cancelled || !canvasRef.current) return;
                const canvas = canvasRef.current;
                const context = canvas.getContext("2d");
                if (!context) return;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({canvas, canvasContext: context, viewport}).promise;
                if (!cancelled) {
                    setPageCount(pdf.numPages);
                    // Store PDF points, not rendered canvas pixels. The backend also stores PDF points.
                    setPageSize({width: viewport.width / 1.5, height: viewport.height / 1.5});
                }
            } catch (err) {
                console.error("PDF field editor render failed", {fileUrl, err});
                if (!cancelled) setError(err instanceof Error ? err.message : "Could not render this PDF page.");
            }
        };
        void loadPage();
        return () => { cancelled = true; };
    }, [fileUrl, pageNumber]);

    useEffect(() => {
        if (!drag) return;
        const move = (event: PointerEvent) => {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (!canvasRect) return;
            const scale = canvasRect.width / pageSize.width;
            const dx = (event.clientX - drag.startX) / scale;
            const dy = (event.clientY - drag.startY) / scale;
            if (drag.mode === "move") {
                setField((current) => ({...current, x: clamp(drag.field.x + dx, 0, pageSize.width - current.width), y: clamp(drag.field.y - dy, 0, pageSize.height - current.height)}));
            } else {
                setField((current) => {
                    const width = clamp(drag.field.width + dx, 60, pageSize.width - drag.field.x);
                    const height = clamp(drag.field.height + dy, 30, pageSize.height - drag.field.y);
                    return {...current, width, height, y: drag.field.y - (height - drag.field.height)};
                });
            }
        };
        const up = () => setDrag(null);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, {once: true});
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
    }, [drag, pageSize]);

    const pageRect = pageRef.current?.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const scale = canvasRect ? canvasRect.width / pageSize.width : 1;
    const visible = field.pageNumber === pageNumber;
    const canvasOffsetX = canvasRect && pageRect ? canvasRect.left - pageRect.left + (pageRef.current?.scrollLeft ?? 0) : 0;
    const canvasOffsetY = canvasRect && pageRect ? canvasRect.top - pageRect.top + (pageRef.current?.scrollTop ?? 0) : 0;
    const left = canvasOffsetX + field.x * scale;
    const top = canvasOffsetY + (pageSize.height - field.y - field.height) * scale;

    return <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Drag the field over the document’s signature line.</p>
            <label className="text-sm flex items-center gap-2">Page <input className="w-16 border rounded px-2 py-1" type="number" min={1} max={pageCount} value={pageNumber} onChange={(event) => setPageNumber(clamp(Number(event.target.value) || 1, 1, pageCount))}/><span>/ {pageCount}</span></label>
        </div>
        <div ref={pageRef} className="relative max-h-[70vh] overflow-auto border rounded bg-muted flex justify-center">
            <canvas ref={canvasRef} className="block max-w-full h-auto"/>
            {visible && <div className="absolute border-2 border-primary bg-primary/15 rounded select-none" style={{left, top, width: field.width * scale, height: field.height * scale, touchAction: "none"}} onPointerDown={(event) => {event.preventDefault(); setDrag({mode: "move", startX: event.clientX, startY: event.clientY, field});}}>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary">Signature</span>
                <span className="absolute -right-2 -bottom-2 size-4 rounded-full bg-primary border-2 border-background cursor-se-resize" onPointerDown={(event) => {event.stopPropagation(); setDrag({mode: "resize", startX: event.clientX, startY: event.clientY, field});}}/>
            </div>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={() => onSave({...field, pageNumber})} disabled={saving}>{saving ? "Saving…" : "Save signature position"}</Button>
    </div>;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}
