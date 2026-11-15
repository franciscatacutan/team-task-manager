package com.example.task_manager.profiling;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.sql.DataSource;
import org.springframework.jdbc.datasource.DelegatingDataSource;

/**
 * Test-only JDBC observation; bindings are replayed only for SELECT EXPLAIN in the test database.
 */
final class ProfileJdbcTrace {
  private ProfileJdbcTrace() {}

  static final ThreadLocal<List<Sample>> CURRENT = new ThreadLocal<>();

  record Binding(Method method, Object[] arguments) {}

  record Sample(String sql, List<Binding> bindings, long nanos) {
    void bind(PreparedStatement statement) throws Exception {
      for (Binding binding : bindings) invoke(statement, binding.method(), binding.arguments());
    }
  }

  static Object invoke(Object target, Method method, Object[] args) throws Exception {
    try {
      return method.invoke(target, args);
    } catch (InvocationTargetException error) {
      if (error.getCause() instanceof Exception cause) throw cause;
      throw error;
    }
  }

  static final class TracedDataSource extends DelegatingDataSource implements AutoCloseable {
    TracedDataSource(DataSource delegate) {
      super(delegate);
    }

    @Override
    public Connection getConnection() throws SQLException {
      return wrap(super.getConnection());
    }

    @Override
    public Connection getConnection(String user, String password) throws SQLException {
      return wrap(super.getConnection(user, password));
    }

    @Override
    public void close() throws Exception {
      if (getTargetDataSource() instanceof AutoCloseable closeable) closeable.close();
    }

    private Connection wrap(Connection connection) {
      return (Connection)
          Proxy.newProxyInstance(
              Connection.class.getClassLoader(),
              new Class<?>[] {Connection.class},
              (proxy, method, args) -> {
                Object value = invoke(connection, method, args);
                if (method.getName().equals("prepareStatement")
                    && args != null
                    && args[0] instanceof String sql
                    && value instanceof PreparedStatement statement) return wrap(statement, sql);
                return value;
              });
    }

    private PreparedStatement wrap(PreparedStatement statement, String sql) {
      Map<Integer, Binding> bindings = new TreeMap<>();
      return (PreparedStatement)
          Proxy.newProxyInstance(
              PreparedStatement.class.getClassLoader(),
              new Class<?>[] {PreparedStatement.class},
              (proxy, method, args) -> {
                if (method.getName().startsWith("set")
                    && args != null
                    && args.length >= 2
                    && args[0] instanceof Integer index)
                  bindings.put(index, new Binding(method, args.clone()));
                if (method.getName().equals("clearParameters")) bindings.clear();
                List<Sample> trace = CURRENT.get();
                if (trace == null || !method.getName().startsWith("execute"))
                  return invoke(statement, method, args);
                long started = System.nanoTime();
                try {
                  return invoke(statement, method, args);
                } finally {
                  trace.add(
                      new Sample(
                          sql, new ArrayList<>(bindings.values()), System.nanoTime() - started));
                }
              });
    }
  }
}
