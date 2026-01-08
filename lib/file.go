package lib

import (
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"github.com/fbn776/inkra/config"
)

func SaveMultipartFile(
	file multipart.File,
	header *multipart.FileHeader,
	dstDir string,
	dstName string,
) (string, error) {

	if header.Size > config.AppConfig.MaxFileSize {
		return "", errors.New("file too large")
	}

	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return "", err
	}

	filename := header.Filename
	if dstName != "" {
		filename = dstName
	}

	dstPath := filepath.Join(dstDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", err
	}

	return dstPath, nil
}

func IsPDF(file multipart.File) (bool, error) {
	buffer := make([]byte, 512)
	_, err := file.Read(buffer)
	if err != nil {
		return false, err
	}

	_, err = file.Seek(0, 0)
	if err != nil {
		return false, err
	}

	return http.DetectContentType(buffer) == "application/pdf", nil
}
