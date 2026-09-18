package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"video-subtitles-backend/internal/config"
	"video-subtitles-backend/internal/db"
	"video-subtitles-backend/internal/httpx"
	"video-subtitles-backend/internal/models"
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type Handler struct {
	DB  *db.DB
	Cfg *config.Config
}

func NewHandler(database *db.DB, cfg *config.Config) *Handler {
	return &Handler{DB: database, Cfg: cfg}
}

type signupRequest struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := normalizeEmail(req.Email)
	if !emailPattern.MatchString(email) {
		httpx.Error(w, http.StatusBadRequest, "enter a valid email address")
		return
	}
	if len(req.Password) < 8 {
		httpx.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if req.Password != req.ConfirmPassword {
		httpx.Error(w, http.StatusBadRequest, "passwords do not match")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	existing := h.DB.Users().FindOne(ctx, bson.M{"email": email})
	if existing.Err() == nil {
		httpx.Error(w, http.StatusConflict, "an account with that email already exists")
		return
	} else if !errors.Is(existing.Err(), mongo.ErrNoDocuments) {
		httpx.Error(w, http.StatusInternalServerError, "something went wrong, try again")
		return
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "something went wrong, try again")
		return
	}

	user := models.User{
		Email:        email,
		PasswordHash: hash,
		CreatedAt:    time.Now(),
	}
	res, err := h.DB.Users().InsertOne(ctx, user)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "something went wrong, try again")
		return
	}
	user.ID = res.InsertedID.(bson.ObjectID)

	h.issueSession(w, user)
	httpx.JSON(w, http.StatusCreated, map[string]any{"user": user})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := normalizeEmail(req.Email)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var user models.User
	err := h.DB.Users().FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		// Same generic message whether the email is unknown or the password is
		// wrong — confirming which one it was would let an attacker enumerate
		// registered emails.
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if !CheckPassword(user.PasswordHash, req.Password) {
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	h.issueSession(w, user)
	httpx.JSON(w, http.StatusOK, map[string]any{"user": user})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     h.Cfg.CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// Me reports whether the request carries a valid session — always a 200, since
// "not logged in" is a normal answer here, not a server error.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(h.Cfg.CookieName)
	if err != nil {
		httpx.JSON(w, http.StatusOK, map[string]bool{"authenticated": false})
		return
	}
	userID, email, err := VerifyToken(h.Cfg.JWTSecret, cookie.Value)
	if err != nil {
		httpx.JSON(w, http.StatusOK, map[string]bool{"authenticated": false})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"user":          map[string]string{"id": userID, "email": email},
	})
}

func (h *Handler) issueSession(w http.ResponseWriter, user models.User) {
	token, err := IssueToken(h.Cfg.JWTSecret, user.ID.Hex(), user.Email, h.Cfg.TokenTTL)
	if err != nil {
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     h.Cfg.CookieName,
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(h.Cfg.TokenTTL),
		HttpOnly: true,
		Secure:   h.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
