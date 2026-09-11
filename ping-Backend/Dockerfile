# Multi-stage build: compile with the full JDK + Maven, ship only the JRE.
#
# The build stage needs Maven, the whole dependency cache and the JDK — several
# hundred megabytes of tooling that has no job at runtime. Keeping it in a
# separate stage means none of it reaches the final image: what ships is a JRE
# and one jar. That matters on a 512MB free instance, and it also shrinks the
# attack surface, since a compiler you don't ship is a compiler nobody can use.

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Dependencies are copied and resolved BEFORE the source. Docker caches each
# layer and reuses it while its inputs are unchanged, so editing a Java file
# invalidates only the layer below and every dependency stays cached. Copying
# everything at once would re-download the internet on every single build.
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

# Documentation only — the platform decides the real port and passes it in as
# $PORT, which application.properties reads. EXPOSE publishes nothing by itself.
EXPOSE 8080

# Two flags that matter on a small instance:
#
#   MaxRAMPercentage tells the JVM to size its heap as a share of the container's
#   memory limit. Without it the JVM guesses from the HOST machine, which on a
#   shared host can be enormous, so it reserves a heap far larger than the 512MB
#   the container is actually allowed — and the platform kills it. A container
#   that dies instantly with no Java stack trace is usually this.
#
#   UseSerialGC: the parallel collectors run threads sized for a real server.
#   On a fraction of one vCPU that overhead buys nothing.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-XX:+UseSerialGC", "-jar", "app.jar"]
