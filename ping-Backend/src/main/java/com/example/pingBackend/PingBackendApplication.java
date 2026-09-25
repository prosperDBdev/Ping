package com.example.pingBackend;

import java.util.TimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling turns on Spring's support for @Scheduled methods —
// without it, ExpiredConversationCleanupJob would compile and start but
// simply never run.
@EnableScheduling
// @ConfigurationPropertiesScan finds every @ConfigurationProperties type under
// com.example.pingBackend and registers it as a bean. The alternative,
// @EnableConfigurationProperties(BrevoProperties.class), would list them here
// one by one instead.
//
// Scanning wins because the declaration that matters — "this type is bound to
// the brevo.* properties" — already sits on the type itself. Repeating it in a
// list here is a second place to keep in sync, and forgetting it doesn't fail
// loudly at the type: it fails at the far-away service that wanted to inject
// it. The same annotation then covers the r2.*, app.* and feedback.* settings
// as they get the same treatment, with no edit to this file.
//
// Nothing is registered by accident either: a class only binds if it carries
// @ConfigurationProperties, which is never something you write by mistake.
@ConfigurationPropertiesScan
@SpringBootApplication
public class PingBackendApplication {

	// Pin the JVM's clock to UTC before anything else runs, including under
	// tests (the class loads there too). Every LocalDateTime.now() is then a
	// UTC time on every machine: a laptop in Lagos and the server agree, and
	// TimeConfig can label them all with "Z" truthfully. Without this, local
	// development would run on the laptop's zone and be off by its offset.
	static {
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
	}

	public static void main(String[] args) {
		SpringApplication.run(PingBackendApplication.class, args);
	}

}
