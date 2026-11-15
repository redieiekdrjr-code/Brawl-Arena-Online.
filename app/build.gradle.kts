plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.sasha.brawlarena"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.sasha.brawlarena"
        minSdk = 23
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
    }
}
