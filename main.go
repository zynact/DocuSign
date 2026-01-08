package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/fbn776/inkra/config"
	"github.com/fbn776/inkra/database"
	"github.com/fbn776/inkra/lib"
	"github.com/fbn776/inkra/routes"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using system env")
	}

	config.Load()

	if err := database.InitDB(); err != nil {
		log.Fatal(err)
	}

	if database.CheckIfInit() == false {
		fmt.Println("Application is not initialized")
		if err := config.RunInit(); err != nil {
			log.Fatal(err)
		}
	}

	r := chi.NewRouter()

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // 5 minutes
	}))

	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)
	r.Use(httprate.LimitByIP(100, 1*time.Minute))

	fileServer := http.FileServer(http.Dir("./docs"))
	r.Handle("/docs/*", http.StripPrefix("/docs", fileServer))

	r.Route("/api", func(r chi.Router) {
		routes.AuthRouter(r)
		routes.DocsRoutes(r)
	})

	r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := "./static" + r.URL.Path
		if _, err := os.Stat(path); err == nil {
			http.ServeFile(w, r, path)
			return
		}
		http.ServeFile(w, r, "./static/index.html")
	}))

	r.NotFound(func(writer http.ResponseWriter, request *http.Request) {
		lib.ErrorJSON(writer, http.StatusNotFound, "Page not found")
	})

	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		lib.ErrorJSON(w, http.StatusMethodNotAllowed, "Method not allowed")
	})

	fmt.Println("Server started on port", config.AppConfig.Port)
	http.ListenAndServe(":"+config.AppConfig.Port, r)
}
