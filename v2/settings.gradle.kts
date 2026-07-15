rootProject.name = "mikroserver"

// `gradle/libs.versions.toml` is auto-imported by Gradle as the `libs` catalog;
// declaring it again here would call `from` twice and fail catalog validation.
dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}
