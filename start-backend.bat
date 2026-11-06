@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-25"
cd /d "%~dp0"
echo Starting Alfaaz Spring Boot Backend on port 8080...
".tools\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run -f backend/pom.xml
pause
