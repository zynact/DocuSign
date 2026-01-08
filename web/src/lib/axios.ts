import axios from "axios";


const ApiInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "/",
    headers: {
        'Content-Type': 'application/json',
    },
});

ApiInstance.interceptors.request.use((config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers["Authorization"] = "Bearer " + token;
        }
        return config;
    }
);

export default ApiInstance;