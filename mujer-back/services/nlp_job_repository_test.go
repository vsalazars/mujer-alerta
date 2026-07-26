package services

import (
	"reflect"
	"testing"
)

func TestBuildNLPJobKeyIncludesInstitutionAndNormalizesCentros(t *testing.T) {
	year := 2026

	got := BuildNLPJobKey(
		42,
		[]int64{9, 3, 9, 5},
		&year,
	)

	want := "institucion:42|centros:3,5,9|year:2026"

	if got != want {
		t.Fatalf("BuildNLPJobKey() = %q; esperado %q", got, want)
	}
}

func TestBuildNLPJobKeyUsesAllWithoutYear(t *testing.T) {
	got := BuildNLPJobKey(
		7,
		[]int64{11},
		nil,
	)

	want := "institucion:7|centros:11|year:all"

	if got != want {
		t.Fatalf("BuildNLPJobKey() = %q; esperado %q", got, want)
	}
}

func TestNormalizeCentroIDs(t *testing.T) {
	got := normalizeCentroIDs([]int64{4, 2, 4, 0, -1, 3})
	want := []int64{2, 3, 4}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf(
			"normalizeCentroIDs() = %#v; esperado %#v",
			got,
			want,
		)
	}
}
