import {useParams} from "react-router";
import {useMutation, useQuery} from "@tanstack/react-query";
import {completeSigningSession, getFileUrl, getSigningSession} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {AlertCircle, CheckCircle2, Loader2, Send} from "lucide-react";
import {SignaturePad, type SignaturePadRef} from "@/components/signature-pad";
import {useRef, useState} from "react";

export default function SignDocPage() {
    const {"doc-id": token} = useParams<{"doc-id": string}>();
    const padRef = useRef<SignaturePadRef>(null);
    const [signerName, setSignerName] = useState("");
    const [remarks, setRemarks] = useState("");
    const [signatureType, setSignatureType] = useState<"drawn" | "uploaded">("drawn");
    const [submitted, setSubmitted] = useState(false);
    const {data, isLoading, isError} = useQuery({queryKey: ["signing-session", token], queryFn: () => getSigningSession(token!), enabled: !!token});
    const session = data?.data;
    const doc = session?.document;
    const mutation = useMutation({
        mutationFn: async () => {
            if (!token || !session || !padRef.current || padRef.current.isEmpty()) throw new Error("Please add your signature before submitting.");
            if (!signerName.trim()) throw new Error("Please enter your full name.");
            const fields = session.fields.filter((f) => f.type !== "signature").map((f) => ({fieldId: f.id, value: f.type === "name" ? signerName.trim() : f.type === "date" ? new Date().toISOString().slice(0, 10) : ""}));
            return completeSigningSession(token, {signerName: signerName.trim(), remarks, signature: {type: signatureType, imageData: padRef.current.getDataUrl()}, fields});
        },
        onSuccess: () => setSubmitted(true),
    });
    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
    if (isError || !session || !doc) return <Status title="Signing link unavailable" message="This link may be expired, revoked, or already completed." error/>;
    if (submitted) return <Status title="Document signed successfully" message="Your signed document has been securely submitted to the document owner."/>;
    return <div className="min-h-screen bg-background p-4 md:p-8"><div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="min-h-[75vh]"><CardHeader><CardTitle>{doc.title}</CardTitle><CardDescription>{doc.description}</CardDescription></CardHeader><CardContent className="h-[calc(75vh-7rem)] min-h-[520px]"><iframe title="Document preview" src={getFileUrl(doc.originalPath)} className="w-full h-full border rounded"/></CardContent></Card>
        <Card className="h-fit"><CardHeader><CardTitle className="text-base">Complete your signature</CardTitle><CardDescription>Your signature will be inserted into the prepared field.</CardDescription></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="signerName">Full name</Label><Input id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Enter your full name"/></div>
            <SignaturePad onChange={(has) => setSignatureType(has ? "drawn" : "drawn")} ref={padRef}/>
            <div className="space-y-2"><Label htmlFor="remarks">Remarks (optional)</Label><Textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3}/></div>
            {mutation.isError && <p className="text-sm text-destructive">{mutation.error.message}</p>}
            <Button className="w-full gap-2" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin"/>Submitting…</> : <><Send className="h-4 w-4"/>Sign and submit</>}</Button>
        </CardContent></Card>
    </div></div>;
}

function Status({title, message, error = false}: {title: string; message: string; error?: boolean}) {
    return <div className="min-h-screen flex items-center justify-center p-4"><Card className="max-w-md w-full"><CardHeader className="text-center"><div className="mx-auto mb-4 p-3 rounded-full bg-muted">{error ? <AlertCircle className="h-8 w-8 text-destructive"/> : <CheckCircle2 className="h-8 w-8 text-green-500"/>}</div><CardTitle>{title}</CardTitle><CardDescription>{message}</CardDescription></CardHeader></Card></div>;
}
