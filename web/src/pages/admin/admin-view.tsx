import {useState} from "react";
import {useNavigate, useParams} from "react-router";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {deleteDoc, getDoc, getFileUrl} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    ExternalLink,
    FileText,
    Globe,
    Loader2,
    MessageSquare,
    Tag,
    Trash2,
    User,
} from "lucide-react";

export default function AdminViewDocPage() {
    const {"doc-id": docId} = useParams<{ "doc-id": string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const {data, isLoading, isError} = useQuery({
        queryKey: ["doc", docId],
        queryFn: () => getDoc(docId!),
        enabled: !!docId,
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteDoc(docId!),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["docs"]});
            navigate("/admin");
        },
    });

    const doc = data?.data;

    const signingLink = new URL(`/doc/sign/${docId}`, window.location.origin).toString();

    const copyLink = async () => {
        await navigator.clipboard.writeText(signingLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            </div>
        );
    }

    if (isError || !doc) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mb-4"/>
                    <h2 className="text-lg font-semibold">Document not found</h2>
                    <p className="text-muted-foreground mb-4">
                        The document you're looking for doesn't exist or has been deleted.
                    </p>
                    <Button onClick={() => navigate("/admin")} variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2"/>
                        Back to Documents
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                    <ArrowLeft className="h-4 w-4 mr-2"/>
                    Back
                </Button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* PDF Preview */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-xl">{doc.title}</CardTitle>
                                    <CardDescription className="mt-1">
                                        {doc.originalName}
                                    </CardDescription>
                                </div>
                                {doc.isSigned ? (
                                    <Badge className="gap-1 bg-green-600">
                                        <CheckCircle2 className="h-3 w-3"/>
                                        Signed
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="gap-1">
                                        <Clock className="h-3 w-3"/>
                                        Pending
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden bg-muted aspect-[4/5]">
                                <iframe
                                    src={getFileUrl(doc.isSigned && doc.signedPath ? doc.signedPath : doc.originalPath)}
                                    className="w-full h-full"
                                    title={doc.title}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Shareable Link */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ExternalLink className="h-4 w-4"/>
                                Shareable Link
                            </CardTitle>
                            <CardDescription>
                                Send this link to your client for signing
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <code className="flex-1 px-3 py-2 bg-muted rounded text-xs truncate">
                                    {signingLink}
                                </code>
                                <Button size="sm" variant="outline" onClick={copyLink}>
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-500"/>
                                    ) : (
                                        <Copy className="h-4 w-4"/>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Document Info */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4"/>
                                Document Info
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {doc.description && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                                    <p className="text-sm">{doc.description}</p>
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground"/>
                                <span className="text-muted-foreground">Created:</span>
                                <span>
                                    {new Date(doc.createdAt).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </span>
                            </div>

                            {(doc.tags || []).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 text-sm mb-2">
                                        <Tag className="h-4 w-4 text-muted-foreground"/>
                                        <span className="text-muted-foreground">Tags</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {doc.tags.map((tag, i) => (
                                            <Badge key={i} variant="outline" className="text-xs">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {doc.ipWhitelist.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 text-sm mb-2">
                                        <Globe className="h-4 w-4 text-muted-foreground"/>
                                        <span className="text-muted-foreground">IP Whitelist</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {doc.ipWhitelist.map((ip, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs font-mono">
                                                {ip}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Signature Info (if signed) */}
                    {doc.isSigned && (
                        <Card className="border-green-500/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2 text-green-600">
                                    <CheckCircle2 className="h-4 w-4"/>
                                    Signature Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {doc.signedAt && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="h-4 w-4 text-muted-foreground"/>
                                        <span className="text-muted-foreground">Signed:</span>
                                        <span>
                                            {new Date(doc.signedAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                )}

                                {doc.signedByIp && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Globe className="h-4 w-4 text-muted-foreground"/>
                                        <span className="text-muted-foreground">IP:</span>
                                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                            {doc.signedByIp}
                                        </code>
                                    </div>
                                )}

                                {doc.signedByMetadata && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <User className="h-4 w-4 text-muted-foreground"/>
                                        <span className="text-muted-foreground">Signer:</span>
                                        <span>{doc.signedByMetadata}</span>
                                    </div>
                                )}

                                {doc.remarks && (
                                    <div>
                                        <div className="flex items-center gap-2 text-sm mb-1">
                                            <MessageSquare className="h-4 w-4 text-muted-foreground"/>
                                            <span className="text-muted-foreground">Remarks</span>
                                        </div>
                                        <p className="text-sm bg-muted p-2 rounded">{doc.remarks}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    <Card className="border-destructive/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="destructive"
                                className="w-full gap-2"
                                onClick={() => setDeleteOpen(true)}
                            >
                                <Trash2 className="h-4 w-4"/>
                                Delete Document
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{doc.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}