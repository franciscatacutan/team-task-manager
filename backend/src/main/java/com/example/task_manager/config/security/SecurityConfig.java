package com.example.task_manager.config.security;

import com.example.task_manager.config.jwt.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/** Configuration class for security settings. */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

  private final JwtAuthFilter jwtAuthFilter;
  private final CustomUserDetailsService userDetailsService;
  private final PasswordEncoder passwordEncoder;

  /** Configures the security filter chain. */
  @Bean
  public SecurityFilterChain securityFilterChain(
      HttpSecurity http,
      CustomAuthenticationEntryPoint authenticationEntryPoint,
      CustomAccessDeniedHandler deniedHandler)
      throws Exception {

    http
        // Disable CSRF for stateless session management
        .csrf(AbstractHttpConfigurer::disable)

        // Enable CORS
        .cors(cors -> {})

        // Authorize requests and endpoint access rules
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/api/auth/**")
                    .permitAll()
                    .requestMatchers("/actuator/health")
                    .permitAll()
                    .requestMatchers("/api/dev/**")
                    .hasAnyRole("ADMIN", "SUPER_ADMIN")
                    .anyRequest()
                    .authenticated())

        // Force stateless session (no HttpSession)
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

        // Add JWT authentication filter
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

        // Exception handling for both unauthenticated and forbidden requests
        .exceptionHandling(
            ex ->
                ex.authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(deniedHandler));

    return http.build();
  }

  @Bean
  public DaoAuthenticationProvider daoAuthenticationProvider() {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder);
    provider.setUserDetailsPasswordService(userDetailsService);
    return provider;
  }

  @Bean
  public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration)
      throws Exception {
    return configuration.getAuthenticationManager();
  }

  @Bean
  public RoleHierarchy roleHierarchy() {
    return RoleHierarchyImpl.fromHierarchy(
        """
            ROLE_SUPER_ADMIN > ROLE_ADMIN
            ROLE_ADMIN > ROLE_USER
        """);
  }
}
