package com.aaron;

import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.util.Map;

import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.aaron.realtime.SupabaseRealtimeClient;
import com.aaron.controllers.CincoCuadradosController;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;

/**
 * Clase principal de la aplicación que integra JavaFX con Spring Boot. Muestra
 * una interfaz con una cuadrícula de botones y permite redimensionarlos
 * automáticamente. También puede activar servicios en segundo plano
 * usando @EnableScheduling.
 */
@SpringBootApplication
@EnableScheduling

public class MainApp extends Application {

  private static String[] savedArgs;
  private ConfigurableApplicationContext springContext;
  private Stage primaryStage;
  private static final double MARGIN = 40;
  private static final int COLUMNS = 4;
  private static final int ROWS = 2;

  /**
   * Método principal de JavaFX. Inicia la aplicación.
   * 
   * @param args argumentos de la línea de comandos
   */
  public static void main(String[] args) {
    savedArgs = args;
    launch(args);
  }

  /**
   * Método de inicialización que se ejecuta antes del método start(). Aquí se
   * arranca el contexto de Spring Boot en modo gráfico
   */
  @Override
  public void init() {
    springContext = new SpringApplicationBuilder(MainApp.class).web(WebApplicationType.NONE).headless(false)
        .run(savedArgs);
    System.out.println("✔ Spring Boot arrancado en modo desktop.");
  }

  /**
   * Método que configura y muestra la interfaz principal.
   * 
   * @param primaryStage ventana principal proporcionada por JavaFX
   */
  @Override
  public void start(Stage primaryStage) throws Exception {
    this.primaryStage = primaryStage;

    FXMLLoader loader = new FXMLLoader(getClass().getResource("/ch/makery/address/view/CincoCuadrados.fxml"));
    loader.setControllerFactory(springContext::getBean);

    Parent root = loader.load();
    CincoCuadradosController controller = loader.getController();

    Scene scene = new Scene(root, 800, 600);
    URL cssUrl = getClass().getResource("/styles.css");
    if (cssUrl != null)
      scene.getStylesheets().add(cssUrl.toExternalForm());

    GridPane grid = (GridPane) scene.lookup("#grid");
    scene.widthProperty().addListener((o, oldV, newV) -> resize(grid, scene));
    scene.heightProperty().addListener((o, oldV, newV) -> resize(grid, scene));

    primaryStage.setTitle("Ocho Mesas Elegantes");
    primaryStage.setScene(scene);
    primaryStage.setMaximized(true);
    primaryStage.show();

    resize(grid, scene);

    // Arranca el cliente Realtime de Supabase

  }

  /**
   * Ajusta dinámicamente el tamaño de los botones dentro de la cuadrícula.
   * 
   * @param grid  el GridPane que contiene los botones
   * @param scene la escena principal que contiene el GridPane
   */
  private void resize(GridPane grid, Scene scene) {
    double w = scene.getWidth() - MARGIN;
    double h = scene.getHeight() - MARGIN;
    double cell = Math.min((w - grid.getHgap() * (COLUMNS - 1)) / COLUMNS, (h - grid.getVgap() * (ROWS - 1)) / ROWS);
    grid.getChildren().forEach(n -> {
      if (n instanceof javafx.scene.control.Button) {
        ((javafx.scene.control.Button) n).setPrefSize(cell, cell);
      }
    });
  }

  /**
   * Método que se llama cuando la aplicación se cierra. Cierra correctamente el
   * contexto de Spring y detiene JavaFX.
   */
  @Override
  public void stop() throws Exception {
    if (springContext != null)
      springContext.close();
    Platform.exit();
  }
}
