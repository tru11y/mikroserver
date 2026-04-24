.PHONY: dev test migrate build docker-build lint clean

dev:
	./gradlew run

test:
	./gradlew test

migrate:
	./gradlew flywayMigrate

build:
	./gradlew buildFatJar

docker-build:
	docker build -t mikroserver:latest .

lint:
	./gradlew ktlintCheck detekt

lint-fix:
	./gradlew ktlintFormat

clean:
	./gradlew clean

seed:
	./gradlew run --args="--seed"
