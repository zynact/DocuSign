import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {z} from "zod";
import {useNavigate} from "react-router";
import ApiInstance from "@/lib/axios.ts";
import {Alert, AlertDescription} from "@/components/ui/alert.tsx";
import {AlertCircle, Loader2} from "lucide-react";
import {Brand} from "@/components/brand";

const loginSchema = z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginSchema = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const navigate = useNavigate();
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginSchema>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginSchema) => {
        try {
            setError("")
            setIsSubmitting(true)

            const res = await ApiInstance.post("/api/login", data);

            window.localStorage.setItem("token", res?.data?.data?.token);

            navigate("/admin")
        } catch (err: any) {
            console.log("Login error:", err.response?.data);
            setError(err?.response?.data?.message || "Login failed. Please check your credentials.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col bg-linear-to-br from-secondary via-background to-background">
            <header className="workspace-container py-6"><Brand /></header>
            <main className="flex flex-1 items-center justify-center px-4 pb-16">
            <Card className="w-full max-w-md shadow-lg shadow-primary/5 sm:p-2">
                <CardHeader className="pb-2">
                    <p className="eyebrow mb-3">Welcome back</p>
                    <CardTitle className="text-3xl tracking-tight">Sign in to Inkra</CardTitle>
                    <CardDescription>Your documents and signatures, all in one place.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-foreground">Email address</label>
                            <Input id="email" {...register("email")} type="email" autoComplete="username" placeholder="you@example.com" />
                            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
                            <Input id="password" autoComplete="current-password" {...register("password")} type="password" placeholder="••••••••" className="bg-card" />
                            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
            </main>
        </div>
    )
}
