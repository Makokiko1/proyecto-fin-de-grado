// src/main/java/com/aaron/realtime/SupabaseRealtimeClient.java
package com.aaron.realtime;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.*;
import java.util.function.Consumer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Cliente Realtime de Supabase para escuchar cambios en la tabla "pedidos" a
 * través de WebSocket. Se conecta automáticamente, reintenta en caso de fallo,
 * y avisa cuando se inserta un nuevo pedido.
 */
public class SupabaseRealtimeClient implements WebSocket.Listener {

  private static final String SUPABASE_URL = "slopghtwuyodfycfwngv.supabase.co";
  private static final String API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsb3BnaHR3dXlvZGZ5Y2Z3bmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3ODE3NDYsImV4cCI6MjA1OTM1Nzc0Nn0.fvKYIoFQt46We1-27DlFxYqvp3Kkdi7KFK76JwXUTCg";

  private final ObjectMapper mapper = new ObjectMapper();
  private final Consumer<Long> onNewOrder;
  private WebSocket webSocket;

  private long lastMessageTime = System.currentTimeMillis();
  private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

  /**
   * Constructor: inicializa el cliente y se conecta.
   * 
   * @param onNewOrder función a ejecutar cuando llega un nuevo pedido
   */
  public SupabaseRealtimeClient(Consumer<Long> onNewOrder) {
    this.onNewOrder = onNewOrder;
    connect();
    startHeartbeatChecker();
  }

  /** Intenta conectar al WebSocket de Supabase Realtime */
  private void connect() {
    System.out.println("🔌 Intentando conectar a Supabase Realtime…");
    HttpClient.newHttpClient().newWebSocketBuilder().header("apikey", API_KEY)
        .buildAsync(URI.create("wss://" + SUPABASE_URL + "/realtime/v1/websocket?apikey=" + API_KEY + "&vsn=1.0.0"),
            this)
        .thenAccept(ws -> {
          this.webSocket = ws;
          System.out.println("✅ Conectado a Supabase Realtime");
          sendJoin();
          ws.request(1);
        }).exceptionally(ex -> {
          System.err.println("⚠️ Error al conectar al WebSocket:");
          ex.printStackTrace();
          return null;
        });
  }

  /** Fuerza reconexión al WebSocket en caso de fallo o desconexión */
  private void reconnect() {
    System.out.println("🔁 Reconectando WebSocket...");
    try {
      if (webSocket != null)
        webSocket.abort();
    } catch (Exception e) {
      e.printStackTrace();
    }
    connect();
  }

  /**
   * Lanza un temporizador para comprobar si el WebSocket ha dejado de responder
   */
  private void startHeartbeatChecker() {
    scheduler.scheduleAtFixedRate(() -> {
      long elapsed = System.currentTimeMillis() - lastMessageTime;
      if (elapsed > 3000) {
        System.out.println("🧠 Posible WebSocket colgado. Reiniciando conexión...");
        reconnect();
      }
    }, 5, 5, TimeUnit.SECONDS);
  }

  /** Se llama cuando el WebSocket se abre correctamente */
  @Override
  public void onOpen(WebSocket ws) {
    System.out.println("⚡ WebSocket abierto");
    ws.request(1);
  }

  /**
   * Envía el mensaje JOIN necesario para suscribirse al canal de la tabla
   * "pedidos"
   */
  private void sendJoin() {
    String msg = """
        {
          "topic":"realtime:public:pedidos",
          "event":"phx_join",
          "payload":{},
          "ref":"1"
        }
        """;
    System.out.println("→ Enviando JOIN: " + msg.trim());
    webSocket.sendText(msg, true);
  }

  /** Envía la suscripción para recibir eventos INSERT sobre la tabla "pedidos" */
  private void sendSubscribe() {
    String sub = """
        {
          "topic":"realtime:public:pedidos",
          "event":"postgres_changes",
          "payload":{
            "schema":"public",
            "table":"pedidos",
            "event":"INSERT",
            "filter":null
          },
          "ref":"2"
        }
        """;
    System.out.println("→ Enviando SUBSCRIBE: " + sub.trim());
    webSocket.sendText(sub, true);
  }

  /**
   * Maneja mensajes entrantes del WebSocket. Detecta nuevos pedidos insertados y
   * llama a la función proporcionada.
   */
  @Override
  public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
    lastMessageTime = System.currentTimeMillis();
    System.out.println("← Evento bruto: " + data);
    try {
      JsonNode node = mapper.readTree(data.toString());
      String event = node.get("event").asText();

      if ("phx_reply".equals(event)) {
        sendSubscribe();
      } else if ("postgres_changes".equals(event) || "INSERT".equals(event)) {
        JsonNode record = node.get("payload").get("record");
        long mesaId = record.get("mesa_id").asLong();
        System.out.println("🎯 Nuevo pedido en mesa: " + mesaId);
        onNewOrder.accept(mesaId);
      }
    } catch (Exception e) {
      System.err.println("⚠️ Error al parsear mensaje:");
      e.printStackTrace();
    }
    ws.request(1);
    return CompletableFuture.completedFuture(null);
  }

  /** Maneja errores en el WebSocket y fuerza reconexión */
  @Override
  public void onError(WebSocket ws, Throwable error) {
    System.err.println("⚠️ WebSocket error:");
    error.printStackTrace();
    reconnect();
  }
}
