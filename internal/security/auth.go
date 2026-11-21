package security

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"github.com/Anarki-LNX/cachencarry/internal/database"
)

// ErrInvalidCredentials is returned for a wrong user name or password.
var ErrInvalidCredentials = errors.New("invalid credentials")

// ErrNoSession is returned when a session token is unknown or expired.
var ErrNoSession = errors.New("no valid session")

// MinPasswordLength is the minimum accepted administrator password length.
const MinPasswordLength = 10

// Session is an authenticated administrative session.
type Session struct {
	UserID   int64
	Username string
	Role     string
	CSRF     string
	Expires  time.Time
}

// Auth manages administrator accounts and sessions.
type Auth struct {
	db  *database.DB
	ttl time.Duration
	// dummyHash keeps login timing independent of whether the user exists.
	dummyHash []byte
}

// NewAuth creates the authentication service.
func NewAuth(db *database.DB, sessionTTL time.Duration) *Auth {
	if sessionTTL <= 0 {
		sessionTTL = 12 * time.Hour
	}
	dummy, _ := bcrypt.GenerateFromPassword([]byte("cachencarry-timing-equaliser"), bcrypt.DefaultCost)
	return &Auth{db: db, ttl: sessionTTL, dummyHash: dummy}
}

// ValidatePassword enforces the password policy.
func ValidatePassword(pw string) error {
	if utf8.RuneCountInString(pw) < MinPasswordLength {
		return fmt.Errorf("password must have at least %d characters", MinPasswordLength)
	}
	if len(pw) > 72 {
		return errors.New("password must not be longer than 72 bytes")
	}
	return nil
}

// HasUsers reports whether at least one administrator exists.
func (a *Auth) HasUsers(ctx context.Context) (bool, error) {
	var n int
	err := a.db.R.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n > 0, err
}

// CreateUser adds an administrator.
func (a *Auth) CreateUser(ctx context.Context, username, password string) error {
	if username == "" || len(username) > 64 {
		return errors.New("user name must have 1 to 64 characters")
	}
	if err := ValidatePassword(password); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = a.db.W.ExecContext(ctx, `INSERT INTO users (username, password_hash, role, created_at)
		VALUES (?, ?, 'admin', ?)`, username, string(hash), time.Now().Unix())
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

// CreateFirstUser creates the initial administrator only if no user exists
// yet. The check and the insert run in one transaction, so two concurrent
// setup requests cannot both succeed.
func (a *Auth) CreateFirstUser(ctx context.Context, username, password string) error {
	if username == "" || len(username) > 64 {
		return errors.New("user name must have 1 to 64 characters")
	}
	if err := ValidatePassword(password); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	res, err := a.db.W.ExecContext(ctx, `INSERT INTO users (username, password_hash, role, created_at)
		SELECT ?, ?, 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
		username, string(hash), time.Now().Unix())
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("setup has already been completed")
	}
	return nil
}

// SetPassword changes a user's password and ends all of their sessions.
func (a *Auth) SetPassword(ctx context.Context, userID int64, password string) error {
	if err := ValidatePassword(password); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	tx, err := a.db.W.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, string(hash), userID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM sessions WHERE user_id = ?`, userID); err != nil {
		return err
	}
	return tx.Commit()
}

// CheckPassword verifies a user's current password.
func (a *Auth) CheckPassword(ctx context.Context, userID int64, password string) bool {
	var hash string
	if err := a.db.R.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id = ?`, userID).Scan(&hash); err != nil {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Login verifies the credentials and creates a session. Only the SHA-256 of
// the returned token is stored, so a leaked database does not reveal usable
// session cookies.
func (a *Auth) Login(ctx context.Context, username, password string) (token string, s *Session, err error) {
	var id int64
	var hash, role string
	qerr := a.db.R.QueryRowContext(ctx, `SELECT id, password_hash, role FROM users WHERE username = ?`,
		username).Scan(&id, &hash, &role)
	if errors.Is(qerr, sql.ErrNoRows) {
		bcrypt.CompareHashAndPassword(a.dummyHash, []byte(password))
		return "", nil, ErrInvalidCredentials
	}
	if qerr != nil {
		return "", nil, qerr
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return "", nil, ErrInvalidCredentials
	}
	if token, err = randomToken(32); err != nil {
		return "", nil, err
	}
	csrf, err := randomToken(24)
	if err != nil {
		return "", nil, err
	}
	now := time.Now()
	s = &Session{UserID: id, Username: username, Role: role, CSRF: csrf, Expires: now.Add(a.ttl)}
	if _, err = a.db.W.ExecContext(ctx, `INSERT INTO sessions (token_hash, user_id, csrf, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?)`, hashToken(token), id, csrf, now.Unix(), s.Expires.Unix()); err != nil {
		return "", nil, err
	}
	return token, s, nil
}

// Session resolves a session token.
func (a *Auth) Session(ctx context.Context, token string) (*Session, error) {
	if token == "" {
		return nil, ErrNoSession
	}
	var s Session
	var exp int64
	err := a.db.R.QueryRowContext(ctx, `SELECT u.id, u.username, u.role, s.csrf, s.expires_at
		FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
		hashToken(token)).Scan(&s.UserID, &s.Username, &s.Role, &s.CSRF, &exp)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoSession
	}
	if err != nil {
		return nil, err
	}
	s.Expires = time.Unix(exp, 0)
	if time.Now().After(s.Expires) {
		return nil, ErrNoSession
	}
	return &s, nil
}

// CSRFMatches compares a submitted CSRF token in constant time.
func (s *Session) CSRFMatches(token string) bool {
	return subtle.ConstantTimeCompare([]byte(s.CSRF), []byte(token)) == 1
}

// Logout deletes a session.
func (a *Auth) Logout(ctx context.Context, token string) error {
	_, err := a.db.W.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, hashToken(token))
	return err
}

// PurgeExpired removes expired sessions.
func (a *Auth) PurgeExpired(ctx context.Context) error {
	_, err := a.db.W.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < ?`, time.Now().Unix())
	return err
}

// Audit appends a record to the audit log. detail must never contain
// credentials.
func Audit(ctx context.Context, db *database.DB, actor, ip, action, detail string) error {
	_, err := db.W.ExecContext(ctx, `INSERT INTO audit_log (ts, actor, ip, action, detail) VALUES (?, ?, ?, ?, ?)`,
		time.Now().Unix(), actor, ip, action, detail)
	return err
}

// RateLimiter is a fixed-window limiter keyed by an arbitrary string
// (typically the client IP).
type RateLimiter struct {
	max    int
	window time.Duration

	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	count int
	reset time.Time
}

// NewRateLimiter allows max events per window for each key.
func NewRateLimiter(max int, window time.Duration) *RateLimiter {
	return &RateLimiter{max: max, window: window, buckets: map[string]*bucket{}}
}

// Allow records an event for key and reports whether it is within the limit.
func (l *RateLimiter) Allow(key string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.buckets) > 10000 { // bound memory under address-spraying
		for k, b := range l.buckets {
			if now.After(b.reset) {
				delete(l.buckets, k)
			}
		}
	}
	b := l.buckets[key]
	if b == nil || now.After(b.reset) {
		b = &bucket{reset: now.Add(l.window)}
		l.buckets[key] = b
	}
	b.count++
	return b.count <= l.max
}
