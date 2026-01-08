import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import {BrowserRouter, Route, Routes} from "react-router";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import LoginPage from "./pages/login.tsx";
import AdminLayout from "./pages/admin/layout.tsx";
import AdminPage from "./pages/admin/page.tsx";
import SignDocPage from "./pages/sign-doc.tsx";
import AdminViewDocPage from "./pages/admin/admin-view.tsx";
import App from "@/App.tsx";
import NotFoundPage from "@/pages/not-found.tsx";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<App/>}/>

                    <Route path="/login" element={<LoginPage/>}/>

                    <Route path="admin" element={<AdminLayout/>}>
                        <Route index element={<AdminPage/>}/>
                        <Route path="view/:doc-id" element={<AdminViewDocPage/>}/>
                    </Route>

                    <Route path="/doc/sign/:doc-id" element={<SignDocPage/>}/>

                    <Route path="*" element={<NotFoundPage/>}/>
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
)
