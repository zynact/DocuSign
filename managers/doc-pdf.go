package managers

import (
	"errors"
	"mime/multipart"

	"github.com/fbn776/inkra/config"
	"github.com/fbn776/inkra/lib"
)

func HandleDocPdfErrors(file *multipart.File, header *multipart.FileHeader) error {
	isPdf, isPdfErr := lib.IsPDF(*file)

	if isPdfErr != nil {
		return errors.New("error parsing pdf")
	}

	if !isPdf {
		return errors.New("file is not a pdf")
	}

	if header == nil {
		return errors.New("no file uploaded")
	}

	if header.Size > config.AppConfig.MaxFileSize {
		return errors.New("file too large")
	}

	return nil
}
