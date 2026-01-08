import {Button} from "@/components/ui/button.tsx";
import {Link} from "react-router";
import {ArrowLeft} from "lucide-react";


export default function NotFoundPage() {
    return (
        <main className="bg-gray-100 min-h-screen gap-6 h-full flex flex-col items-center justify-center p-4">
            <div>
                <h1 className="text-4xl text-center font-bold">404 - Page Not Found</h1>
                <p className="max-w-xl mx-auto mt-4 text-center text-muted-foreground">
                    The page you are looking for does not exist.
                </p>
            </div>

            <Button asChild>
                <Link to="/">
                    <ArrowLeft/> Go Home
                </Link>
            </Button>
        </main>
    );
}