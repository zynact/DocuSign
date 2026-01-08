import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router";
import {getDocs} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {UploadDialog} from "@/components/upload-dialog";
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    FileText,
    Loader2,
    Plus,
    Search,
} from "lucide-react";
import {useDebounce} from "@/hooks/use-debounced.tsx";

type SignedFilter = "all" | "signed" | "unsigned";

const limit = 12;


export default function AdminPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [signedFilter, setSignedFilter] = useState<SignedFilter>("all");
    const [uploadOpen, setUploadOpen] = useState(false);

    const debouncedKeyword = useDebounce(search, 500)


    const {data, isLoading, isError, error} = useQuery({
        queryKey: ["docs", page, debouncedKeyword, signedFilter],
        queryFn: () =>
            getDocs({
                page,
                limit,
                keyword: debouncedKeyword || undefined,
                signed: signedFilter === "all" ? undefined : signedFilter === "signed" ? "true" : "false",
            }),
    });

    const docs = data?.data?.docs || [];
    const total = data?.data?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Documents</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your PDF documents and signatures
                    </p>
                </div>
                <Button onClick={() => setUploadOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4"/>
                    Upload Document
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <form onSubmit={(e) => {
                    e.preventDefault();
                }} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                        <Input
                            placeholder="Search documents..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button type="submit" variant="secondary">
                        Search
                    </Button>
                </form>

                <div className="flex gap-2">
                    {(["all", "unsigned", "signed"] as const).map((filter) => (
                        <Button
                            key={filter}
                            variant={signedFilter === filter ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setSignedFilter(filter);
                                setPage(1);
                            }}
                            className="capitalize cursor-pointer"
                        >
                            {filter}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
            )}

            {/* Error State */}
            {isError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mb-4"/>
                    <h2 className="text-lg font-semibold">Failed to load documents</h2>
                    <p className="text-muted-foreground">
                        {error instanceof Error ? error.message : "Please try again later"}
                    </p>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && docs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4"/>
                    <h2 className="text-lg font-semibold">No documents found</h2>
                    <p className="text-muted-foreground mb-4">
                        {search
                            ? "Try a different search term"
                            : "Upload your first document to get started"}
                    </p>
                    {!search && (
                        <Button onClick={() => setUploadOpen(true)} className="gap-2">
                            <Plus className="h-4 w-4"/>
                            Upload Document
                        </Button>
                    )}
                </div>
            )}

            {/* Document Grid */}
            {!isLoading && !isError && docs.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {docs.map((doc) => (
                            <Link to={`/admin/view/${doc.id}`} key={doc.id}
                                  className="cursor-pointer hover:shadow-lg hover:outline-primary hover:outline-1 transition-shadow">
                                <Card
                                    key={doc.id}
                                    // onClick={() => navigate(`/admin/view/${doc.id}`)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="text-base truncate">
                                                    {doc.title}
                                                </CardTitle>
                                                <CardDescription className="line-clamp-2 mt-1">
                                                    {doc.description || "No description"}
                                                </CardDescription>
                                            </div>
                                            {doc.isSigned ? (
                                                <Badge variant="default" className="shrink-0 gap-1 bg-green-600">
                                                    <CheckCircle2 className="h-3 w-3"/>
                                                    Signed
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="shrink-0 gap-1">
                                                    <Clock className="h-3 w-3"/>
                                                    Pending
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {(doc.tags || []).slice(0, 3).map((tag, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {(doc.tags || []).length > 3 && (
                                                <Badge variant="outline" className="text-xs">
                                                    +{doc.tags.length - 3}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(doc.createdAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </p>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4"/>
                            </Button>
                            <span className="text-sm text-muted-foreground px-4">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                <ChevronRight className="h-4 w-4"/>
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Upload Dialog */}
            <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen}/>
        </div>
    );
}
