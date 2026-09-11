package com.example.pingBackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling turns on Spring's support for @Scheduled methods —
// without it, ExpiredConversationCleanupJob would compile and start but
// simply never run.
@EnableScheduling
@SpringBootApplication
public class PingBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PingBackendApplication.class, args);
	}

}
