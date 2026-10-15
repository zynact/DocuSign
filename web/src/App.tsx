import {Button} from "@/components/ui/button";
import {Link} from "react-router";
import {Brand} from "@/components/brand";
import {ArrowRight, FileText, PenLine, Send} from "lucide-react";

export default function App() {
    const token = localStorage.getItem("token");

    return <main className="bg-linear-to-b from-secondary/70 to-background min-h-screen flex flex-col">
        <header className="workspace-container py-6"><Brand subtitle="Simple document signing" /></header>
        <div className="workspace-container flex-1 flex flex-col justify-center py-16">
            <p className="eyebrow text-center mb-4">Less paperwork. More progress.</p>
            <h1 className="text-4xl sm:text-6xl text-center font-semibold tracking-tight leading-tight">Your next signature,<br/><span className="text-[#087443]">made simple.</span></h1>
            <p className="max-w-xl mx-auto mt-6 text-center text-muted-foreground leading-relaxed">
                A self-hosted, privacy-first PDF signing platform that lets clients sign contracts directly in the
                browser. No downloads, no third-party tools.
            </p>

            <div className="mt-8 flex justify-center">
                {
                    token ? <Button asChild>
                        <Link to="/admin">
                            Go to Admin Panel
                            <ArrowRight className="size-4"/>
                        </Link>
                    </Button> : <Button asChild>
                        <Link to="/login">
                            Login to Admin Panel
                            <ArrowRight className="size-4"/>
                        </Link>
                    </Button>
                }
            </div>
            <div className="mx-auto mt-14 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
                {[{icon: FileText, title: "Upload your PDF", detail: "Keep your documents in one place."}, {icon: Send, title: "Share a signing link", detail: "Invite your client. No account needed."}, {icon: PenLine, title: "Get it signed", detail: "Sign in the browser and download."}].map(({icon: Icon, title, detail}) => (
                    <div key={title} className="rounded-2xl border bg-card p-6"><Icon className="size-5 text-[#087443] mb-4"/><h2 className="text-sm font-semibold">{title}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p></div>
                ))}
            </div>
        </div>

        <div className="w-full flex items-center justify-center p-6">
            <a href="https://github.com/fbn776/Inkra" aria-label="Inkra on GitHub">
                <img src="/github-mark.svg" alt="Github Icon" className="size-[28px]"/>
            </a>
        </div>
    </main>
}
