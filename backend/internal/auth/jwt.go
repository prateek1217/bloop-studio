package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type claims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

// IssueToken signs a JWT identifying userID/email, valid for ttl.
func IssueToken(secret []byte, userID, email string, ttl time.Duration) (string, error) {
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	})
	return token.SignedString(secret)
}

// VerifyToken returns the userID and email embedded in a valid, unexpired token.
func VerifyToken(secret []byte, tokenString string) (userID string, email string, err error) {
	parsed, err := jwt.ParseWithClaims(tokenString, &claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		return "", "", err
	}
	c, ok := parsed.Claims.(*claims)
	if !ok || !parsed.Valid {
		return "", "", fmt.Errorf("invalid token")
	}
	return c.Subject, c.Email, nil
}
