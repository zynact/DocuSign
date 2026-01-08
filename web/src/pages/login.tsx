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
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">PDF Sign Manager</CardTitle>
                    <CardDescription>Sign in to your account to manage documents</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Email</label>
                            <Input {...register("email")} type="email" placeholder="you@example.com" className="bg-input" />
                            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Password</label>
                            <Input {...register("password")} type="password" placeholder="••••••••" className="bg-input" />
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
        </div>
    )
}
