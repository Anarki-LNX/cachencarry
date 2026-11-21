package config

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Duration is a time.Duration that unmarshals from strings such as "5m" and
// additionally understands a "d" (day) suffix.
type Duration time.Duration

// ParseDuration parses a duration string with optional day suffix.
func ParseDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return 0, nil
	}
	if strings.HasSuffix(s, "d") {
		n, err := strconv.ParseFloat(strings.TrimSuffix(s, "d"), 64)
		if err != nil {
			return 0, fmt.Errorf("invalid duration %q", s)
		}
		return time.Duration(n * 24 * float64(time.Hour)), nil
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid duration %q", s)
	}
	return d, nil
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (d *Duration) UnmarshalYAML(n *yaml.Node) error {
	v, err := ParseDuration(n.Value)
	if err != nil {
		return err
	}
	*d = Duration(v)
	return nil
}

// MarshalYAML implements yaml.Marshaler.
func (d Duration) MarshalYAML() (any, error) { return time.Duration(d).String(), nil }

// Std returns the value as a time.Duration.
func (d Duration) Std() time.Duration { return time.Duration(d) }

// ByteSize is a byte count that unmarshals from strings such as "500GB" or
// "4TiB". Decimal and binary suffixes are both interpreted as powers of 1024,
// which matches what users expect from storage tools.
type ByteSize int64

// ParseByteSize parses a human readable size.
func ParseByteSize(s string) (ByteSize, error) {
	s = strings.ToUpper(strings.TrimSpace(s))
	if s == "" || s == "0" {
		return 0, nil
	}
	units := []struct {
		suffix string
		mult   float64
	}{
		{"PIB", 1 << 50}, {"TIB", 1 << 40}, {"GIB", 1 << 30}, {"MIB", 1 << 20}, {"KIB", 1 << 10},
		{"PB", 1 << 50}, {"TB", 1 << 40}, {"GB", 1 << 30}, {"MB", 1 << 20}, {"KB", 1 << 10},
		{"P", 1 << 50}, {"T", 1 << 40}, {"G", 1 << 30}, {"M", 1 << 20}, {"K", 1 << 10},
		{"B", 1},
	}
	mult := 1.0
	num := s
	for _, u := range units {
		if strings.HasSuffix(s, u.suffix) {
			mult = u.mult
			num = strings.TrimSpace(strings.TrimSuffix(s, u.suffix))
			break
		}
	}
	f, err := strconv.ParseFloat(num, 64)
	if err != nil || f < 0 {
		return 0, fmt.Errorf("invalid size %q", s)
	}
	return ByteSize(f * mult), nil
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (b *ByteSize) UnmarshalYAML(n *yaml.Node) error {
	v, err := ParseByteSize(n.Value)
	if err != nil {
		return err
	}
	*b = v
	return nil
}

// MarshalYAML implements yaml.Marshaler.
func (b ByteSize) MarshalYAML() (any, error) { return strconv.FormatInt(int64(b), 10), nil }

// applyEnv applies UNICACHE_<SECTION>_<KEY> overrides to scalar fields of the
// top-level sections and UNICACHE_MODULES_<NAME>_ENABLED to modules.
func applyEnv(cfg *Config, environ []string) error {
	env := map[string]string{}
	for _, kv := range environ {
		k, v, ok := strings.Cut(kv, "=")
		if ok && strings.HasPrefix(k, "UNICACHE_") {
			env[k] = v
		}
	}
	if len(env) == 0 {
		return nil
	}
	root := reflect.ValueOf(cfg).Elem()
	rt := root.Type()
	for i := 0; i < rt.NumField(); i++ {
		section := root.Field(i)
		if section.Kind() != reflect.Struct {
			continue
		}
		secName := strings.ToUpper(yamlName(rt.Field(i)))
		st := section.Type()
		for j := 0; j < st.NumField(); j++ {
			key := "UNICACHE_" + secName + "_" + strings.ToUpper(yamlName(st.Field(j)))
			val, ok := env[key]
			if !ok {
				continue
			}
			if err := setField(section.Field(j), val); err != nil {
				return fmt.Errorf("%s: %w", key, err)
			}
		}
	}
	for name, m := range cfg.Modules {
		key := "UNICACHE_MODULES_" + strings.ToUpper(name) + "_ENABLED"
		if val, ok := env[key]; ok {
			b, err := strconv.ParseBool(val)
			if err != nil {
				return fmt.Errorf("%s: %w", key, err)
			}
			m.Enabled = b
			cfg.Modules[name] = m
		}
	}
	return nil
}

func yamlName(f reflect.StructField) string {
	tag, _, _ := strings.Cut(f.Tag.Get("yaml"), ",")
	if tag == "" {
		return strings.ToLower(f.Name)
	}
	return tag
}

func setField(f reflect.Value, val string) error {
	switch f.Interface().(type) {
	case Duration:
		d, err := ParseDuration(val)
		if err != nil {
			return err
		}
		f.SetInt(int64(d))
		return nil
	case ByteSize:
		b, err := ParseByteSize(val)
		if err != nil {
			return err
		}
		f.SetInt(int64(b))
		return nil
	case []string:
		var out []string
		for _, p := range strings.Split(val, ",") {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
		f.Set(reflect.ValueOf(out))
		return nil
	}
	switch f.Kind() {
	case reflect.String:
		f.SetString(val)
	case reflect.Int, reflect.Int64:
		n, err := strconv.ParseInt(val, 10, 64)
		if err != nil {
			return err
		}
		f.SetInt(n)
	case reflect.Bool:
		b, err := strconv.ParseBool(val)
		if err != nil {
			return err
		}
		f.SetBool(b)
	default:
		return fmt.Errorf("unsupported override type %s", f.Type())
	}
	return nil
}
