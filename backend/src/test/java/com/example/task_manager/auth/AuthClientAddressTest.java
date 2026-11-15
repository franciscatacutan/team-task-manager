package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthClientAddressTest {
  @Test
  void directConnectionsIgnoreClientSuppliedHeaders() {
    var request = request();
    request.addHeader(AuthClientAddress.PROXY_HEADER, "192.0.2.10");
    assertThat(new AuthClientAddress(false).resolve(request)).isEqualTo("192.0.2.1");
  }

  @Test
  void proxyModeUsesOnlyTheDedicatedAddressHeader() {
    var proxy = new AuthClientAddress(true);
    var request = request();
    assertThat(proxy.resolve(request)).isEqualTo("192.0.2.1");
    request.addHeader(AuthClientAddress.PROXY_HEADER, "192.0.2.10");
    assertThat(proxy.resolve(request)).isEqualTo("192.0.2.10");
  }

  @Test
  void proxyAddressMustBeAnIpLiteral() {
    var proxy = new AuthClientAddress(true);
    var request = request();
    request.addHeader(AuthClientAddress.PROXY_HEADER, "192.0.2.10, 192.0.2.11");
    assertThat(proxy.resolve(request)).isEqualTo("192.0.2.1");
    var ipv6Request = request();
    ipv6Request.addHeader(AuthClientAddress.PROXY_HEADER, "2001:db8::10");
    assertThat(proxy.resolve(ipv6Request)).isEqualTo("2001:db8:0:0:0:0:0:10");
  }

  private MockHttpServletRequest request() {
    var request = new MockHttpServletRequest();
    request.setRemoteAddr("192.0.2.1");
    request.addHeader("X-Forwarded-For", "192.0.2.20");
    return request;
  }
}
