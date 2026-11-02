package com.example.task_manager.config.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.beans.factory.annotation.Value;

/*
  * Configures CORS settings for the application.
*/
@Configuration
public class CorsConfig {

  // Frontend URL from application properties
  @Value("${frontend.url}")
  private String frontEndApi;

  @Bean
  public CorsFilter corsFilter() {
    // CORS configuration
    CorsConfiguration config = new CorsConfiguration();
    // Allow requests from the frontend URL
    config.addAllowedOrigin(frontEndApi);
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);

    // Register CORS configuration for all paths
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return new CorsFilter(source);
  }
}
