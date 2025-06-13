
package com.aaron.controllers;

import java.io.IOException;
import java.net.URL;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.ResourceBundle;
import java.util.function.Consumer;

import com.aaron.realtime.SupabaseRealtimeClient;
import javafx.application.Platform;
import javafx.event.ActionEvent;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.fxml.Initializable;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.layout.GridPane;
import javafx.stage.Modality;
import javafx.stage.Stage;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

/**
 * Controlador del panel principal con las 8 mesas representadas como botones.
 * Cada botón reacciona al click para mostrar los detalles de pedidos de esa
 * mesa. Además, se integra con Supabase Realtime para recibir eventos en tiempo
 * real.
 */
@Component
public class CincoCuadradosController implements Initializable {

  @FXML
  private GridPane grid;
  @FXML
  private Button table1, table2, table3, table4;
  @FXML
  private Button table5, table6, table7, table8;

  private Map<Long, Button> tableMap;
  private Map<Long, String> originalStyleMap;

  @Autowired
  private ApplicationContext ctx;

  /**
   * Método que se ejecuta automáticamente al inicializar la vista FXML. Aquí se
   * asignan los botones al mapa de mesas y se arranca el cliente de Supabase
   * Realtime.
   */
  @Override
  public void initialize(URL url, ResourceBundle rb) {
    tableMap = new LinkedHashMap<>();
    originalStyleMap = new LinkedHashMap<>();

    // 1) pobla mapas y guarda estilo original
    tableMap.put(1L, table1);
    tableMap.put(2L, table2);
    tableMap.put(3L, table3);
    tableMap.put(4L, table4);
    tableMap.put(5L, table5);
    tableMap.put(6L, table6);
    tableMap.put(7L, table7);
    tableMap.put(8L, table8);
    tableMap.forEach((id, btn) -> {
      btn.setUserData(id);
      originalStyleMap.put(id, btn.getStyle());
    });

    // 2) arranca cliente Realtime
    Consumer<Long> onNewOrder = mesaId -> {
      Button b = tableMap.get(mesaId);
      if (b != null) {
        Platform.runLater(() -> b.setStyle("-fx-background-color: yellow;"));
      }
    };
    new SupabaseRealtimeClient(onNewOrder);
  }

  /**
   * Maneja el evento cuando se hace clic en una mesa. Abre una nueva ventana
   * modal con los detalles de la mesa seleccionada.
   * 
   * @param e evento generado al hacer clic en el botón
   */
  @FXML
  private void handleTableClick(ActionEvent e) {
    Button btn = (Button) e.getSource();
    Long mesaId = (Long) btn.getUserData();

    try {
      // 3) carga FXML de detalles
      FXMLLoader loader = new FXMLLoader(getClass().getResource("/ch/makery/address/view/DetailView.fxml"));
      loader.setControllerFactory(ctx::getBean);
      Parent root = loader.load();

      // 4) inicializa controlador
      DetailController dc = loader.getController();
      dc.loadOrder(mesaId);

      // 5) abre modal
      Stage dialog = new Stage();
      dialog.initModality(Modality.APPLICATION_MODAL);
      dialog.setTitle("Detalles – Mesa " + mesaId);

      Scene scene = new Scene(root);

      scene.getStylesheets().add(getClass().getResource("/styles/detail.css").toExternalForm());

      dialog.setScene(scene);
      dialog.show();
    } catch (IOException ex) {
      ex.printStackTrace();
    }
  }

  /**
   * Devuelve el mapa de mesas para que otros controladores puedan acceder a los
   * botones.
   * 
   * @return mapa con ID de mesa y su botón asociado
   */
  public Map<Long, Button> getMesasMap() {
    return tableMap;
  }

  /**
   * Devuelve el estilo original de una mesa por su ID. Esto se usa para restaurar
   * el color original del botón cuando se actualiza el estado.
   * 
   * @param mesaId ID de la mesa
   * @return estilo CSS original del botón
   */
  public String getOriginalStyle(Long mesaId) {
    return originalStyleMap.get(mesaId);
  }
}
