import { FileSignature } from "lucide-react";

export function Brand({ subtitle = "Document workspace" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
        <FileSignature className="size-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight leading-6">Inkra<span className="text-[#087443]">.</span></p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
