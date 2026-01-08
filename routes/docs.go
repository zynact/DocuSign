package routes

import (
	"github.com/fbn776/inkra/controllers"
	"github.com/fbn776/inkra/middleware"
	"github.com/go-chi/chi/v5"
)

func DocsRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuthMiddleware)

		r.Get("/docs", controllers.GetAllDocs)
		r.Get("/docs/{id}", controllers.GetDocById)
		r.Post("/docs", controllers.CreateDoc)
		r.Put("/docs/{id}", controllers.UpdateDoc)
		r.Delete("/docs/{id}", controllers.DeleteDoc)
	})

	r.Get("/docs/view/{id}", controllers.ViewDoc)
	r.Post("/docs/sign/{id}", controllers.SignDoc)
}
