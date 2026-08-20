@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
set "PATH=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot\bin;%PATH%"
cd /d "d:\zenwill.me\app\android"
echo Building APK...
call gradlew.bat assembleDebug
