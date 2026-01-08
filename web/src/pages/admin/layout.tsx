import { Outlet, useNavigate } from "react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AdminLayout() {
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-lg font-semibold">
                                Inkra
                            </h1>
                            <p className="text-xs text-muted-foreground">Document Management</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="gap-2"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main>
                <Outlet />
            </main>
        </div>
    );
}