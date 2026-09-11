package com.example.pingBackend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

/**
 * Wires up an S3-compatible client pointed at Cloudflare R2.
 *
 * R2 speaks the same API as AWS S3, so the standard AWS SDK works against it —
 * you just point it at R2's endpoint instead of AWS's, and pass R2's own
 * access/secret key pair (from R2 > Manage API Tokens), not AWS credentials.
 */
@Configuration
@Slf4j
public class StorageConfig {

    @Value("${r2.account-id}")
    private String accountId;

    @Value("${r2.access-key}")
    private String accessKey;

    @Value("${r2.secret-key}")
    private String secretKey;

    @Bean
    public S3Client s3Client() {
        // Environment variables set through an IDE's "Environment variables"
        // field are a common source of accidental leading/trailing whitespace
        // (a stray space after the "=" ends up as part of the value, not a
        // separator). Trim defensively so that never turns into a startup crash.
        accountId = accountId.trim();
        accessKey = accessKey.trim();
        secretKey = secretKey.trim();

        // If R2 isn't configured yet, don't let that take down the whole app —
        // auth, text messaging, everything else should keep working regardless
        // of whether this one optional integration is set up. The AWS SDK's own
        // credentials builder throws immediately on a blank key, which would
        // otherwise fail Spring's ENTIRE startup over a feature nobody's using
        // yet. So: substitute obviously-fake placeholder values when unconfigured,
        // let the bean (and therefore the whole app) start normally, and let the
        // real failure happen later and in the right place — R2 rejecting an
        // actual upload/download attempt with an auth error, not a boot crash.
        boolean configured = !accountId.isBlank() && !accessKey.isBlank() && !secretKey.isBlank();
        if (!configured) {
            log.warn("R2 storage is not configured (R2_ACCOUNT_ID/R2_ACCESS_KEY/R2_SECRET_KEY) — " +
                    "voice notes and other media features will fail until it is.");
        }

        String effectiveAccountId = configured ? accountId : "not-configured";
        String effectiveAccessKey = configured ? accessKey : "not-configured";
        String effectiveSecretKey = configured ? secretKey : "not-configured";

        return S3Client.builder()
                .endpointOverride(URI.create("https://" + effectiveAccountId + ".r2.cloudflarestorage.com"))
                // R2 has no real AWS regions — "auto" is what Cloudflare's docs specify.
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(effectiveAccessKey, effectiveSecretKey)))
                // Path-style addressing (endpoint/bucket/key) rather than virtual-hosted
                // (bucket.endpoint/key) — the safer default for S3-compatible providers
                // that aren't AWS itself.
                .forcePathStyle(true)
                .build();
    }
}
