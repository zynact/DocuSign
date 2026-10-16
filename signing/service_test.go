package signing

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/fbn776/inkra/database"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

func TestRenderC2PAMultipagePDF(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "original.pdf")
	writeC2PAFixture(t, input)
	img := image.NewRGBA(image.Rect(0, 0, 180, 60))
	for y := 10; y < 50; y++ {
		for x := 10; x < 170; x++ {
			img.Set(x, y, color.Black)
		}
	}
	var signature bytes.Buffer
	if err := png.Encode(&signature, img); err != nil {
		t.Fatal(err)
	}
	field := database.DocumentField{Type: "signature", PageNumber: 5, X: 143.25, Y: 350.78, Width: 180, Height: 60}
	output := filepath.Join(dir, "signed.pdf")
	err := RenderSignedPDF(input, output, field, signature.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	file, err := os.Open(output)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	ctx, err := api.ReadContext(file, model.NewDefaultConfiguration())
	if err != nil {
		t.Fatal(err)
	}
	if err := validateSigningContext(ctx); err != nil {
		t.Fatal(err)
	}
	if ctx.PageCount != 5 {
		t.Fatalf("got %d pages", ctx.PageCount)
	}
	manifestFound := false
	for _, entry := range ctx.Table {
		if strings.Contains(fmt.Sprint(entry.Object), "C2PA_Manifest") {
			manifestFound = true
		}
	}
	if !manifestFound {
		t.Fatal("C2PA metadata was lost")
	}
	for page := 1; page <= 5; page++ {
		_, _, attrs, err := ctx.PageDict(page, false)
		if err != nil {
			t.Fatal(err)
		}
		hasSignature := attrs.Resources != nil && attrs.Resources["XObject"] != nil
		if hasSignature != (page == 5) {
			t.Fatalf("signature resources on page %d: %v", page, hasSignature)
		}
	}
	field.Type = "name"
	if err := RenderTextPDF(output, filepath.Join(dir, "with-name.pdf"), "Test Signer", field); err != nil {
		t.Fatal(err)
	}
}

func writeC2PAFixture(t *testing.T, path string) {
	t.Helper()
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R /AF [9 0 R] /Names << /EmbeddedFiles << /Names [(manifest.c2pa) 9 0 R] >> >> >>",
		"<< /Type /Pages /Count 5 /Kids [3 0 R 4 0 R 5 0 R 6 0 R 7 0 R] >>",
	}
	for range 5 {
		objects = append(objects, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 8 0 R >>")
	}
	objects = append(objects,
		"<< /Length 0 >>\nstream\n\nendstream",
		"<< /Type /Filespec /F (manifest.c2pa) /UF (manifest.c2pa) /AFRelationship /C2PA_Manifest /EF << /F 10 0 R >> >>",
		"<< /Type /EmbeddedFile /Subtype /application#2Fc2pa /Length 4 >>\nstream\ntest\nendstream",
	)
	var pdf bytes.Buffer
	pdf.WriteString("%PDF-1.7\n")
	offsets := []int{0}
	for i, object := range objects {
		offsets = append(offsets, pdf.Len())
		fmt.Fprintf(&pdf, "%d 0 obj\n%s\nendobj\n", i+1, object)
	}
	xref := pdf.Len()
	fmt.Fprintf(&pdf, "xref\n0 %d\n0000000000 65535 f \n", len(offsets))
	for _, offset := range offsets[1:] {
		fmt.Fprintf(&pdf, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&pdf, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xref)
	if err := os.WriteFile(path, pdf.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
}
