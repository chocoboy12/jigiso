plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.example.jigiso"
    compileSdk = flutter.compileSdkVersion
    // NDK volontairement non déclaré : aucune dépendance de ce projet n'a de
    // code natif C/C++ (vérifié : aucun CMakeLists.txt côté Android dans les
    // paquets installés). Le déclarer forçait Gradle à télécharger ~1 Go
    // inutilement — et ce téléchargement échouait en boucle ici.
    // À remettre (`ndkVersion = flutter.ndkVersion`) si un plugin natif arrive.

    compileOptions {
        // Rappels de visite (flutter_local_notifications) : API java.time
        // rétroportées sur les anciens Android
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.example.jigiso"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
