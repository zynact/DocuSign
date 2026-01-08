package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/fbn776/inkra/database"
	"golang.org/x/crypto/bcrypt"
)

func RunInit() error {
	count := 0
	err := database.DB.QueryRow("SELECT Count(*) from SETTINGS").Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		fmt.Println("Application already initialized")
		return nil
	}

	adminUsername := AppConfig.AdminUsername
	adminPassword := AppConfig.AdminPassword

	if adminPassword == "" || adminUsername == "" {
		reader := bufio.NewReader(os.Stdin)
		fmt.Print("Admin Username: ")
		email, _ := reader.ReadString('\n')
		adminUsername = strings.TrimSpace(email)

		fmt.Print("Admin password: ")
		password, _ := reader.ReadString('\n')
		adminPassword = strings.TrimSpace(password)
	}

	hash, _ := bcrypt.GenerateFromPassword(
		[]byte(adminPassword),
		bcrypt.DefaultCost,
	)

	_, err = database.DB.Exec("INSERT INTO SETTINGS (login_email, login_password_hash) VALUES (?, ?)", adminUsername, hash)

	fmt.Println("Initialization completed")

	return err
}
