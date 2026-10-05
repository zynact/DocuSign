package signing

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/fbn776/inkra/database"
	"github.com/google/uuid"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	xdraw "golang.org/x/image/draw"
)

type SignatureInput struct {
	Type      string `json:"type"`
	ImageData string `json:"imageData"`
}

type FieldValue struct {
	FieldID string `json:"fieldId"`
	Value   string `json:"value"`
}

type CompleteRequest struct {
	SignerName string         `json:"signerName"`
	Remarks    string         `json:"remarks"`
	Signature  SignatureInput `json:"signature"`
	Fields     []FieldValue   `json:"fields"`
}

func DecodeSignatureImage(dataURL string) ([]byte, error) {
	return decodeImage(dataURL)
}

func RenderTextPDF(inputPath, outputPath, text string, field database.DocumentField) error {
	if field.Type != "name" && field.Type != "date" && field.Type != "text" {
		return errors.New("selected field is not a text field")
	}
	if strings.TrimSpace(text) == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}
	desc := fmt.Sprintf("pos:bl, off:%s %s, points:12, scale:1 abs, rot:0", strconv.FormatFloat(field.X, 'f', 2, 64), strconv.FormatFloat(field.Y, 'f', 2, 64))
	return api.AddTextWatermarksFile(inputPath, outputPath, []string{strconv.Itoa(field.PageNumber)}, true, text, desc, nil)
}

func decodeImage(dataURL string) ([]byte, error) {
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 || !strings.Contains(parts[0], "base64") {
		return nil, errors.New("signature must be a base64 data URL")
	}
	b, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil || len(b) == 0 || len(b) > 5<<20 {
		return nil, errors.New("invalid or oversized signature image")
	}
	return b, nil
}

func normalizeSignature(data []byte, width, height int) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("signature image is invalid")
	}
	trimmed, srcBounds, err := trimSignature(img)
	if err != nil {
		return nil, err
	}
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.Transparent), image.Point{}, draw.Src)
	// Fit the actual ink, not the source image's transparent/white margins.
	scale := float64(width) / float64(srcBounds.Dx())
	if h := float64(srcBounds.Dy()) * scale; h > float64(height) {
		scale = float64(height) / float64(srcBounds.Dy())
	}
	w := int(float64(srcBounds.Dx()) * scale)
	h := int(float64(srcBounds.Dy()) * scale)
	if w < 1 || h < 1 {
		return nil, errors.New("signature image has invalid dimensions")
	}
	xdraw.ApproxBiLinear.Scale(dst, image.Rect((width-w)/2, (height-h)/2, (width-w)/2+w, (height-h)/2+h), trimmed, srcBounds, xdraw.Over, nil)
	var out bytes.Buffer
	if err := pngEncode(&out, dst); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func trimSignature(src image.Image) (image.Image, image.Rectangle, error) {
	bounds := src.Bounds()

	// Convert all input formats to RGBA and remove white backgrounds. This
	// makes uploaded JPEG/WebP-converted signatures behave like drawn PNGs.
	nrgba := image.NewNRGBA(bounds)
	draw.Draw(nrgba, bounds, src, bounds.Min, draw.Src)
	minX, minY := bounds.Max.X, bounds.Max.Y
	maxX, maxY := bounds.Min.X, bounds.Min.Y
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			idx := nrgba.PixOffset(x, y)
			r, g, b, a := nrgba.Pix[idx], nrgba.Pix[idx+1], nrgba.Pix[idx+2], nrgba.Pix[idx+3]
			if a < 16 || (r > 245 && g > 245 && b > 245) {
				nrgba.Pix[idx+3] = 0
				continue
			}
			if x < minX {
				minX = x
			}
			if y < minY {
				minY = y
			}
			if x > maxX {
				maxX = x
			}
			if y > maxY {
				maxY = y
			}
		}
	}
	if minX > maxX || minY > maxY {
		return nil, image.Rectangle{}, errors.New("signature image contains no visible ink")
	}
	// Add a small margin so the ink is not clipped when it is fitted.
	const margin = 4
	minX = maxInt(bounds.Min.X, minX-margin)
	minY = maxInt(bounds.Min.Y, minY-margin)
	maxX = minInt(bounds.Max.X-1, maxX+margin)
	maxY = minInt(bounds.Max.Y-1, maxY+margin)
	return nrgba, image.Rect(minX, minY, maxX+1, maxY+1), nil
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Kept in a small wrapper so the signing service has one output format.
func pngEncode(buf *bytes.Buffer, img image.Image) error {
	return png.Encode(buf, img)
}

func RenderSignedPDF(originalPath, outputPath string, field database.DocumentField, signature []byte) error {
	if field.Type != "signature" {
		return errors.New("selected field is not a signature field")
	}
	tmpDir, err := os.MkdirTemp("", "inkra-signature-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)
	imagePath := filepath.Join(tmpDir, uuid.NewString()+".png")
	normalized, err := normalizeSignature(signature, int(field.Width), int(field.Height))
	if err != nil {
		return err
	}
	if err := os.WriteFile(imagePath, normalized, 0600); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}
	desc := fmt.Sprintf("pos:bl, off:%s %s, scale:1 abs, rot:0", strconv.FormatFloat(field.X, 'f', 2, 64), strconv.FormatFloat(field.Y, 'f', 2, 64))
	return api.AddImageWatermarksFile(originalPath, outputPath, []string{strconv.Itoa(field.PageNumber)}, true, imagePath, desc, nil)
}
