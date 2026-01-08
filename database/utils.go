package database

func CheckIfInit() bool {
	var count int

	err := DB.QueryRow("SELECT COUNT(*) FROM settings").Scan(&count)
	if err != nil {
		return false
	}

	return count > 0
}
