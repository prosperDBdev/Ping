package com.example.pingBackend;

import com.mongodb.client.MongoClient;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.DbRefResolver;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;

@SpringBootTest
class PingBackendApplicationTests {

	@TestConfiguration
	static class MongoTestConfig {
		@Bean
		public MongoCustomConversions mongoCustomConversions() {
			return MongoCustomConversions.create(adapter -> {});
		}

		@Bean
		public MongoMappingContext mongoMappingContext(MongoCustomConversions conversions) {
			MongoMappingContext context = new MongoMappingContext();
			context.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
			return context;
		}

		@Bean
		@Primary
		public MongoConverter mongoConverter(MongoMappingContext context) {
			DbRefResolver dbRefResolver = Mockito.mock(DbRefResolver.class);
			MappingMongoConverter converter = new MappingMongoConverter(dbRefResolver, context);
			converter.setCustomConversions(new MongoCustomConversions(List.of()));
			converter.afterPropertiesSet();
			return converter;
		}

		@Bean
		@Primary
		public MongoTemplate mongoTemplate(MongoDatabaseFactory factory, MongoConverter converter) {
			MongoTemplate template = Mockito.mock(MongoTemplate.class);
			Mockito.when(template.getConverter()).thenReturn(converter);
			Mockito.when(template.indexOps(Mockito.anyString())).thenReturn(Mockito.mock(org.springframework.data.mongodb.core.index.IndexOperations.class));
			Mockito.when(template.updateMulti(Mockito.any(), Mockito.any(), Mockito.any(Class.class)))
					.thenReturn(com.mongodb.client.result.UpdateResult.acknowledged(0, 0L, null));
			return template;
		}
	}

	@MockitoBean
	private MongoDatabaseFactory mongoDatabaseFactory;

	@MockitoBean
	private MongoClient mongoClient;

	@Test
	void contextLoads() {
	}

}









