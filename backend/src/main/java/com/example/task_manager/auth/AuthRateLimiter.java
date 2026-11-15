package com.example.task_manager.auth;

import com.example.task_manager.exception.api.TooManyRequestsException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Bounded, per-instance request limits for accepting credentials. */
@Component
class AuthRateLimiter {
  private static final int MAX_TRACKED_KEYS = 16_384;
  private final WindowCounter<String> loginClients;
  private final WindowCounter<LoginKey> loginIdentities;
  private final WindowCounter<String> registrationClients;
  private final LongSupplier nanoTime;

  @Autowired
  AuthRateLimiter(
      @Value("${auth.rate-limit.window}") Duration window,
      @Value("${auth.rate-limit.login-per-client}") int loginPerClient,
      @Value("${auth.rate-limit.login-per-email-and-client}") int loginPerIdentity,
      @Value("${auth.rate-limit.registration-per-client}") int registrationPerClient) {
    this(
        window,
        loginPerClient,
        loginPerIdentity,
        registrationPerClient,
        MAX_TRACKED_KEYS,
        System::nanoTime);
  }

  AuthRateLimiter(
      Duration window,
      int loginPerClient,
      int loginPerIdentity,
      int registrationPerClient,
      int capacity,
      LongSupplier nanoTime) {
    this.nanoTime = nanoTime;
    if (window.isNegative()
        || window.isZero()
        || capacity < 1
        || loginPerClient < 1
        || loginPerIdentity < 1
        || registrationPerClient < 1) {
      throw new IllegalArgumentException("Authentication rate limits must be positive");
    }
    long windowNanos = window.toNanos();
    loginClients = new WindowCounter<>(loginPerClient, capacity, windowNanos);
    loginIdentities = new WindowCounter<>(loginPerIdentity, capacity, windowNanos);
    registrationClients = new WindowCounter<>(registrationPerClient, capacity, windowNanos);
  }

  synchronized void checkLogin(String client, String email) {
    long now = nanoTime.getAsLong();
    var identity = new LoginKey(client, email.trim().toLowerCase(Locale.ROOT));
    long wait =
        Math.max(loginClients.waitNanos(client, now), loginIdentities.waitNanos(identity, now));
    requireAvailable(wait);
    loginClients.record(client, now);
    loginIdentities.record(identity, now);
  }

  synchronized void checkRegistration(String client) {
    long now = nanoTime.getAsLong();
    requireAvailable(registrationClients.waitNanos(client, now));
    registrationClients.record(client, now);
  }

  private static void requireAvailable(long waitNanos) {
    if (waitNanos > 0) {
      throw new TooManyRequestsException(Duration.ofNanos(waitNanos));
    }
  }

  private record LoginKey(String client, String email) {}

  private static final class WindowCounter<K> {
    private final int limit;
    private final int capacity;
    private final long windowNanos;
    private final LinkedHashMap<K, Window> windows = new LinkedHashMap<>();

    private WindowCounter(int limit, int capacity, long windowNanos) {
      this.limit = limit;
      this.capacity = capacity;
      this.windowNanos = windowNanos;
    }

    private long waitNanos(K key, long now) {
      var first = windows.firstEntry();
      while (first != null && first.getValue().endsAt - now <= 0) {
        windows.pollFirstEntry();
        first = windows.firstEntry();
      }

      Window window = windows.get(key);
      if (window != null) {
        return window.count >= limit ? window.endsAt - now : 0;
      }
      // Keep active counters even under load so rotating identities cannot evict them.
      return windows.size() == capacity ? windows.firstEntry().getValue().endsAt - now : 0;
    }

    private void record(K key, long now) {
      windows.computeIfAbsent(key, unused -> new Window(now + windowNanos)).count++;
    }
  }

  private static final class Window {
    private final long endsAt;
    private int count;

    private Window(long endsAt) {
      this.endsAt = endsAt;
    }
  }
}
