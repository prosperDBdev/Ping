package com.example.pingBackend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class MongoTest implements CommandLineRunner {

    @Value("${spring.data.mongodb.uri:NOT_SET}")
    private String mongoUri;

    @Override
    public void run(String... args) {
        System.out.println("========================================");
        System.out.println("MONGO URI: " + mongoUri);
        System.out.println("========================================");
    }
}
