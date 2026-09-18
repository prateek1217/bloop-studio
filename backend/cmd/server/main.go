package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"video-subtitles-backend/internal/auth"
	"video-subtitles-backend/internal/config"
	"video-subtitles-backend/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	database, err := db.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		log.Fatalf("mongodb error: %v", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = database.Close(ctx)
	}()

	h := auth.NewHandler(database, cfg)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("POST /api/auth/signup", h.Signup)
	mux.HandleFunc("POST /api/auth/login", h.Login)
	mux.HandleFunc("POST /api/auth/logout", h.Logout)
	mux.HandleFunc("GET /api/auth/me", h.Me)

	log.Printf("backend listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, logRequests(mux)); err != nil {
		log.Fatal(err)
	}
}

// logRequests is intentionally the only middleware here — this app is meant
// to sit behind Next.js's rewrite proxy (see next.config.ts), which keeps the
// browser same-origin with the backend, so no CORS handling is needed for the
// real frontend flow.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}
