package com.example.task_manager.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Resolves the client through a private proxy that overwrites the dedicated header. */
@Component
class AuthClientAddress {
  static final String PROXY_HEADER = "X-TTM-Client-IP";
  private static final Pattern IPV4 = Pattern.compile("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}");
  private static final Pattern IPV6 = Pattern.compile("[0-9a-fA-F:.]*:[0-9a-fA-F:.]*");

  private final boolean trustProxy;

  AuthClientAddress(@Value("${auth.trust-proxy-client-ip:false}") boolean trustProxy) {
    this.trustProxy = trustProxy;
  }

  String resolve(HttpServletRequest request) {
    if (trustProxy) {
      String address = request.getHeader(PROXY_HEADER);
      if (address != null && address.length() <= 45) {
        String ip = parseLiteral(address);
        if (ip != null) return ip;
      }
    }
    return request.getRemoteAddr();
  }

  private static String parseLiteral(String address) {
    try {
      if (IPV6.matcher(address).matches()) {
        return InetAddress.getByName(address).getHostAddress();
      }
      if (IPV4.matcher(address).matches()) {
        String[] parts = address.split("\\.");
        byte[] octets = new byte[4];
        for (int index = 0; index < octets.length; index++) {
          int octet = Integer.parseInt(parts[index]);
          if (octet > 255) return null;
          octets[index] = (byte) octet;
        }
        return InetAddress.getByAddress(octets).getHostAddress();
      }
    } catch (UnknownHostException ignored) {
      // The proxy should only send a numeric address.
    }
    return null;
  }
}
