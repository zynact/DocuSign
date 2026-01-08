import {Button} from "@/components/ui/button";
import {Link} from "react-router";

export default function App() {
    const token = localStorage.getItem("token");

    return <main className="bg-gray-100 min-h-screen h-full flex items-center justify-center p-4">
        <div>
            <h1 className="text-4xl text-center font-bold">Inrka</h1>
            <p className="max-w-xl mx-auto mt-4 text-center text-muted-foreground">
                A self-hosted, privacy-first PDF signing platform that lets clients sign contracts directly in the
                browser. No downloads, no third-party tools.
            </p>

            <div className="mt-8 flex justify-center">
                {
                    token ? <Button asChild>
                        <Link to="/admin">
                            Go to Admin Panel
                        </Link>
                    </Button> : <Button asChild>
                        <Link to="/login">
                            Login to Admin Panel
                        </Link>
                    </Button>
                }
            </div>
        </div>

        <div className="bottom-0 absolute w-full flex items-center justify-center p-4">
            <a href="https://github.com/fbn776/Inkra">
                <img src="/github-mark.svg" alt="Github Icon" className="size-[28px]"/>
            </a>
        </div>
    </main>
}