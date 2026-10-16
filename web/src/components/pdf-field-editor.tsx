import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { DocumentField } from "@/types";
import { fieldTop, fitPdfFieldToPage, movePdfField, resizePdfField } from "@/lib/pdf-field-coordinates";

// Bundle the worker from the same pdfjs-dist package as the API. PDF.js
// rejects workers from a different version.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfFieldEditorProps {
  fileUrl: string;
  initialField: DocumentField;
  onSave: (field: DocumentField) => void;
  onCancel?: () => void;
  saving?: boolean;
}

export function PdfFieldEditor({
  fileUrl,
  initialField,
  onSave,
  onCancel,
  saving = false,
}: PdfFieldEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const selectedFieldRef = useRef(initialField);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [renderedPage, setRenderedPage] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialField.pageNumber);
  const [pageCount, setPageCount] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [field, setField] = useState(initialField);
  const [drag, setDrag] = useState<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    field: DocumentField;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setField(initialField);
    selectedFieldRef.current = initialField;
    pageSizeRef.current = null;
    setPageNumber(initialField.pageNumber);
  }, [initialField]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | undefined;
    const controller = new AbortController();
    setPdf(null);
    setRenderedPage(null);
    setError(null);
    const loadDocument = async () => {
      try {
        // Do not send Authorization headers to the static file server.
        // That would trigger a CORS preflight in dev/tunnel environments.
        const response = await fetch(fileUrl, { credentials: "same-origin", signal: controller.signal });
        if (!response.ok)
          throw new Error(`PDF request failed with HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("pdf"))
          throw new Error(
            `Expected PDF but received ${contentType || "unknown content"}`,
          );
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({
          data: bytes,
        });
        const document = await loadingTask.promise;
        if (cancelled) return;
        setPdf(document);
        setPageCount(document.numPages);
        setPageNumber((current) => clamp(current, 1, document.numPages));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this PDF.");
      }
    };
    void loadDocument();
    return () => {
      cancelled = true;
      controller.abort();
      void loadingTask?.destroy();
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | undefined;
    setRenderedPage(null);
    setError(null);
    const loadPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) {
          // Store PDF points, not rendered canvas pixels. The backend also stores PDF points.
          const size = {
            width: viewport.width / 1.5,
            height: viewport.height / 1.5,
          };
          const next = {
            ...fitPdfFieldToPage(selectedFieldRef.current, pageSizeRef.current?.height ?? size.height, size.width, size.height),
            pageNumber,
          };
          selectedFieldRef.current = next;
          pageSizeRef.current = size;
          setField(next);
          setPageSize(size);
          setRenderedPage(pageNumber);
          scrollRef.current?.scrollTo({ top: 0, left: 0 });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("PDF field editor render failed", { fileUrl, err });
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Could not render this PDF page.",
          );
      }
    };
    void loadPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, fileUrl, pageNumber]);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      if (!canvasRect.width || !canvasRect.height) return;
      const dx = (event.clientX - drag.startX) * pageSize.width / canvasRect.width;
      const dy = (event.clientY - drag.startY) * pageSize.height / canvasRect.height;
      const update = drag.mode === "move" ? movePdfField : resizePdfField;
      const next = update(drag.field, dx, dy, pageSize.width, pageSize.height);
      selectedFieldRef.current = next;
      setField(next);
    };
    const up = (event: PointerEvent) => {
      move(event);
      logCoordinates("selected", selectedFieldRef.current, pageSize);
      setDrag(null);
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag, pageSize]);

  const ready = !!pdf && renderedPage === pageNumber && !error;
  const visible = ready && field.pageNumber === pageNumber;
  const top = fieldTop(field, pageSize.height);
  const selectPage = (value: number) => {
    setDrag(null);
    setPageNumber(clamp(Math.trunc(value) || 1, 1, pageCount));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-secondary/30 p-3">
        {onCancel && (
          <Button variant="outline" className="gap-2" onClick={onCancel} disabled={saving}>
            <ArrowLeft className="h-4 w-4" />
            Back to preview
          </Button>
        )}
        <Button
          className="ml-auto"
          onClick={() => {
            const saved = { ...field };
            logCoordinates("save", saved, pageSize);
            onSave(saved);
          }}
          disabled={saving || !ready || !!drag}
        >
          {saving ? "Saving…" : "Save signature position"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Choose the signature page, then drag the field over the signature line.
        </p>
        <div className="text-sm flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!pdf || saving || pageNumber <= 1} onClick={() => selectPage(pageNumber - 1)}>Previous</Button>
          <label className="flex items-center gap-2">
            Page{" "}
            <input
              className="w-16 border rounded-lg bg-card px-2 py-2"
              type="number"
              min={1}
              max={pageCount}
              step={1}
              disabled={!pdf || saving}
              value={pageNumber}
              onChange={(event) => selectPage(Number(event.target.value))}
            />
            <span>/ {pageCount}</span>
          </label>
          <Button type="button" variant="outline" size="sm" disabled={!pdf || saving || pageNumber >= pageCount} onClick={() => selectPage(pageNumber + 1)}>Next</Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        aria-busy={!ready && !error}
        className="max-h-[70vh] overflow-auto border rounded-xl bg-muted"
      >
        <div className="relative mx-auto max-w-full" style={{ width: pageSize.width * 1.5 }}>
        <canvas ref={canvasRef} className={`block w-full h-auto ${ready ? "" : "invisible"}`} />
        {visible && (
          <div
            className="absolute border-2 border-primary bg-primary/15 rounded select-none"
            style={{
              left: `${field.x / pageSize.width * 100}%`,
              top: `${top / pageSize.height * 100}%`,
              width: `${field.width / pageSize.width * 100}%`,
              height: `${field.height / pageSize.height * 100}%`,
              touchAction: "none",
            }}
            onPointerDown={(event) => {
              if (saving) return;
              event.preventDefault();
              setDrag({
                mode: "move",
                startX: event.clientX,
                startY: event.clientY,
                field,
              });
            }}
          >
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary">
              Signature
            </span>
            <span
              className="absolute -right-2 -bottom-2 size-4 rounded-full bg-primary border-2 border-background cursor-se-resize"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (saving) return;
                setDrag({
                  mode: "resize",
                  startX: event.clientX,
                  startY: event.clientY,
                  field,
                });
              }}
            />
          </div>
        )}
        </div>
      </div>
      {!ready && !error && <p role="status" className="text-sm text-muted-foreground">Loading page {pageNumber}…</p>}
      <p className="text-xs leading-relaxed text-muted-foreground rounded-lg bg-muted/60 p-3">
        Position from top-left: x {field.x.toFixed(2)}, y {top.toFixed(2)} pt.
        {" "}PDF bottom-left: x {field.x.toFixed(2)}, y {field.y.toFixed(2)} pt.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

    </div>
  );
}

function logCoordinates(
  action: string,
  field: DocumentField,
  pageSize: { width: number; height: number },
) {
  console.log(`[PdfFieldEditor] ${action} signature coordinates (points)`, {
    pageNumber: field.pageNumber,
    pageSize,
    topLeft: { x: field.x, y: fieldTop(field, pageSize.height) },
    pdfBottomLeft: { x: field.x, y: field.y },
    width: field.width,
    height: field.height,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
