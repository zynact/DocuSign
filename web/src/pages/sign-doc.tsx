import { useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  completeSigningSession,
  getFileUrl,
  getSigningSession,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, Mail, PenLine, Send } from "lucide-react";
import { Brand } from "@/components/brand";
import { SignaturePad, type SignaturePadRef } from "@/components/signature-pad";
import { useRef, useState } from "react";
import { isAxiosError } from "axios";

export default function SignDocPage() {
  const { "doc-id": token } = useParams<{ "doc-id": string }>();
  const padRef = useRef<SignaturePadRef>(null);
  const [signerName, setSignerName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [signatureType, setSignatureType] = useState<"drawn" | "uploaded">(
    "drawn",
  );
  const [submitted, setSubmitted] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["signing-session", token],
    queryFn: () => getSigningSession(token!),
    enabled: !!token,
  });
  const session = data?.data;
  const doc = session?.document;
  const mutation = useMutation({
    mutationFn: async () => {
      if (!token || !session || !padRef.current || padRef.current.isEmpty())
        throw new Error("Please add your signature before submitting.");
      if (!signerName.trim()) throw new Error("Please enter your full name.");
      const fields = session.fields
        .filter((f) => f.type !== "signature")
        .map((f) => ({
          fieldId: f.id,
          value:
            f.type === "name"
              ? signerName.trim()
              : f.type === "date"
                ? new Date().toISOString().slice(0, 10)
                : "",
        }));
      return completeSigningSession(token, {
        signerName: signerName.trim(),
        remarks,
        signature: {
          type: signatureType,
          imageData: padRef.current.getDataUrl(),
        },
        fields,
      });
    },
    onSuccess: () => setSubmitted(true),
  });
  if (isLoading)
    return (
      <div className="min-h-screen flex flex-col gap-4 items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-[#087443]" />
        <p className="text-sm text-muted-foreground">Preparing your document…</p>
      </div>
    );
  if (isError || !session || !doc)
    return (
      <Status
        title="Signing link unavailable"
        message="This link may be expired, revoked, or unavailable."
        error
      />
    );
  if (submitted || session.session.status === "completed")
    return (
      <SignedDocument
        token={token!}
        title={doc.title}
        expiresAt={session.session.expiresAt}
      />
    );
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="workspace-container flex flex-wrap items-center justify-between gap-4 py-4">
          <Brand subtitle="Document signing" />
          <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground" aria-label="Review the document, then sign">
            <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-secondary font-semibold text-[#087443]">1</span> Review</span>
            <span className="h-px w-6 bg-border" aria-hidden="true"/>
            <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">2</span> Sign</span>
          </div>
        </div>
      </header>
      <main className="workspace-container py-6 sm:py-8">
        <div className="mb-6">
          <p className="eyebrow mb-2">You're invited to sign</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Review. Sign. All done.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Read the document, then add your name and signature to finish.</p>
        </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <Card className="min-w-0">
          <CardHeader>
            <p className="eyebrow mb-2 flex items-center gap-2"><FileText className="size-4"/> Document preview</p>
            <CardTitle className="text-lg break-words">{doc.title}</CardTitle>
            <CardDescription className="break-words">{doc.description}</CardDescription>
          </CardHeader>
          <CardContent className="h-[65vh] min-h-80 lg:h-[72vh]">
            <div className="document-stage h-full">
            <iframe
              title="Document preview"
              src={getFileUrl(doc.originalPath)}
              className="w-full h-full border rounded-lg bg-white"
            />
            </div>
          </CardContent>
        </Card>
        <Card className="h-fit border-primary/20">
          <CardHeader className="border-b bg-secondary/40 -mt-6 pt-6">
            <p className="eyebrow mb-2 flex items-center gap-2"><PenLine className="size-4"/> Your signature</p>
            <CardTitle className="text-lg">Make it official</CardTitle>
            <CardDescription>
              Your signature will be inserted into the prepared field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="signerName">Full name</Label>
              <Input
                id="signerName"
                autoComplete="name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
            <p className="text-sm font-medium">Signature</p>
            <SignaturePad
              onChange={(has) => setSignatureType(has ? "drawn" : "drawn")}
              ref={padRef}
            />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {isAxiosError<{ message?: string }>(mutation.error)
                  ? mutation.error.response?.data?.message || "Could not submit the signed document. Please try again."
                  : mutation.error.message}
              </p>
            )}
            <Button
              className="w-full gap-2"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Sign and submit
                </>
              )}
            </Button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">Once submitted, your signature will be added to the document. You can then download your signed copy.</p>
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  );
}

function SignedDocument({ token, title, expiresAt }: { token: string; title: string; expiresAt: string }) {
  const downloadUrl = getFileUrl(`/api/signing-sessions/${encodeURIComponent(token)}/download`);
  const expiry = new Date(expiresAt).toLocaleString();
  const subject = encodeURIComponent(`Signed document: ${title}`);
  const body = encodeURIComponent(
    `Hello,

Here is the signed document "${title}":
${downloadUrl}

This download link is available until ${expiry}.

Anyone with this link can download the signed PDF.`,
  );

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-secondary/80 to-background">
      <header className="workspace-container py-6"><Brand subtitle="Document signing" /></header>
      <main className="flex flex-1 items-center justify-center p-4 pb-16">
      <Card className="max-w-xl w-full shadow-lg shadow-primary/5">
        <CardHeader className="text-center sm:px-10 pt-4">
          <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-secondary ring-8 ring-secondary/40"><CheckCircle2 className="size-10 text-[#087443]" /></div>
          <p className="eyebrow mb-2">Signing complete</p>
          <CardTitle className="text-2xl tracking-tight">You're all set.</CardTitle>
          <CardDescription>Your signed document has been submitted to the document owner. You can download and share your copy below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 sm:px-10 pb-4">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/50 p-4"><FileText className="size-5 shrink-0 text-[#087443]"/><p className="text-sm font-medium break-words min-w-0">{title}</p><CheckCircle2 className="ml-auto size-4 shrink-0 text-[#087443]"/></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1 gap-2" onClick={() => window.location.assign(downloadUrl)}>
              <Download className="h-4 w-4" />
              Download signed PDF
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={() => window.location.assign(`mailto:?subject=${subject}&body=${body}`)}>
              <Mail className="h-4 w-4" />
              Share by email
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Share by email opens your mail app with a download link. To send an attachment, download the PDF and attach it to your email.
          </p>
          <p className="text-xs text-muted-foreground">
            Download available until {expiry}. Anyone with the shared link can download this signed document.
          </p>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}

function Status({
  title,
  message,
  error = false,
}: {
  title: string;
  message: string;
  error?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="workspace-container py-6"><Brand subtitle="Document signing" /></header>
      <main className="flex flex-1 items-center justify-center p-4 pb-16">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-muted">
            {error ? (
              <AlertCircle className="h-8 w-8 text-destructive" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            )}
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
      </main>
    </div>
  );
}
