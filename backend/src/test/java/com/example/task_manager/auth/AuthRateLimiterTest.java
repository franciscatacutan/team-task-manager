package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.*;

import com.example.task_manager.exception.api.TooManyRequestsException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class AuthRateLimiterTest {
  private static final String OFFICE = "192.0.2.10";
  private static final String EMAIL = "person@example.test";
  private final AtomicLong time = new AtomicLong();
  private final AuthRateLimiter limiter =
      new AuthRateLimiter(Duration.ofSeconds(10), 4, 2, 2, 16, time::get);

  @Test
  void normalizesEmailAndKeepsTeammatesAndOtherNetworksIndependent() {
    limiter.checkLogin(OFFICE, EMAIL);
    limiter.checkLogin(OFFICE, "Person@EXAMPLE.test");
    assertThatExceptionOfType(TooManyRequestsException.class)
        .isThrownBy(() -> limiter.checkLogin(OFFICE, EMAIL));
    limiter.checkLogin(OFFICE, "teammate@example.test");
    limiter.checkLogin("192.0.2.11", EMAIL);
  }

  @Test
  void capsRotatingEmailsAndKeepsSignupSeparate() {
    for (int i = 0; i < 4; i++) {
      limiter.checkLogin(OFFICE, "person" + i + "@example.test");
    }
    assertThatExceptionOfType(TooManyRequestsException.class)
        .isThrownBy(() -> limiter.checkLogin(OFFICE, "another@example.test"));

    limiter.checkRegistration(OFFICE);
    limiter.checkRegistration(OFFICE);
    assertThatExceptionOfType(TooManyRequestsException.class)
        .isThrownBy(() -> limiter.checkRegistration(OFFICE));
    limiter.checkRegistration("192.0.2.11");
  }

  @Test
  void blockedRequestsDoNotExtendTheWindowAndWaitIsRoundedUp() {
    limiter.checkRegistration(OFFICE);
    limiter.checkRegistration(OFFICE);
    time.set(Duration.ofMillis(9_500).toNanos());
    assertThatExceptionOfType(TooManyRequestsException.class)
        .isThrownBy(() -> limiter.checkRegistration(OFFICE))
        .satisfies(error -> assertThat(error.getRetryAfterSeconds()).isEqualTo(1));
    time.set(Duration.ofSeconds(10).toNanos());
    limiter.checkRegistration(OFFICE);
  }

  @Test
  void admitsOnlyTheConfiguredNumberOfConcurrentAttempts() {
    long admitted =
        IntStream.range(0, 16)
            .parallel()
            .filter(
                attempt -> {
                  try {
                    limiter.checkLogin(OFFICE, EMAIL);
                    return true;
                  } catch (TooManyRequestsException expected) {
                    return false;
                  }
                })
            .count();
    assertThat(admitted).isEqualTo(2);
  }

  @Test
  void saturatedStorageRetainsActiveKeysAndRecoversAfterExpiry() {
    var smallLimiter = new AuthRateLimiter(Duration.ofSeconds(10), 4, 2, 2, 1, time::get);
    smallLimiter.checkLogin(OFFICE, EMAIL);
    assertThatExceptionOfType(TooManyRequestsException.class)
        .isThrownBy(() -> smallLimiter.checkLogin(OFFICE, "other@example.test"));
    smallLimiter.checkLogin(OFFICE, EMAIL);
    assertThatExceptionOfType(TooManyRequestsException.class)
        .isThrownBy(() -> smallLimiter.checkLogin(OFFICE, EMAIL));
    time.set(Duration.ofSeconds(10).toNanos());
    smallLimiter.checkLogin(OFFICE, "other@example.test");
  }
}
