package com.aaron.controllers;

import java.net.URL;

import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.ResourceBundle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import javafx.application.Platform;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.*;
import javafx.stage.Stage;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.aaron.model.EstadoPedido;
import com.aaron.model.LineaPedido;
import com.aaron.model.Pedido;
import com.aaron.repository.LineaPedidoRepository;
import com.aaron.repository.PedidoRepository;

/**
 * Controlador de la vista de detalle de pedidos para una mesa específica.
 * Permite visualizar los pedidos, su estado, el contenido con personalizaciones
 * y cerrar la cuenta.
 */
@Component
public class DetailController implements Initializable {

  @FXML
  private Label mesaLabel;
  @FXML
  private Label totalMesaLabel;
  @FXML
  private TextArea descripcionLabel;

  @FXML
  private TableView<Pedido> ordersTable;
  @FXML
  private TableColumn<Pedido, Long> orderIdColumn;
  @FXML
  private TableColumn<Pedido, String> orderDateColumn;
  @FXML
  private TableColumn<Pedido, EstadoPedido> orderStateColumn;

  @FXML
  private TableView<LineaPedido> orderTable;
  @FXML
  private TableColumn<LineaPedido, String> itemColumn;
  @FXML
  private TableColumn<LineaPedido, Double> priceColumn;

  @FXML
  private ComboBox<EstadoPedido> statusComboBox;
  @FXML
  private Button stateButton, closeButton;

  private Long mesaId;
  private Pedido currentPedido;

  private final PedidoRepository pedidoRepo;
  private final LineaPedidoRepository lineaRepo;
  private final CincoCuadradosController cincoCtrl;

  /**
   * Constructor con inyección de dependencias desde Spring.
   */
  @Autowired
  public DetailController(PedidoRepository pedidoRepo, LineaPedidoRepository lineaRepo,
      CincoCuadradosController cincoCtrl) {
    this.pedidoRepo = pedidoRepo;
    this.lineaRepo = lineaRepo;
    this.cincoCtrl = cincoCtrl;
  }

  /**
   * Inicializa las columnas de las tablas, los colores de las filas por estado y
   * el contenido del combo de estados.
   */
  @Override
  public void initialize(URL url, ResourceBundle rb) {
    orderIdColumn.setCellValueFactory(p -> new SimpleObjectProperty<>(p.getValue().getId()));
    orderDateColumn.setCellValueFactory(p -> {
      String txt = p.getValue().getFecha().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
      return new SimpleStringProperty(txt);
    });
    orderStateColumn.setCellValueFactory(p -> new SimpleObjectProperty<>(p.getValue().getEstado()));

    ordersTable.setRowFactory(tv -> new TableRow<Pedido>() {
      @Override
      protected void updateItem(Pedido ped, boolean empty) {
        super.updateItem(ped, empty);
        getStyleClass().removeAll("pending", "preparacion", "servido", "pagado_ind");

        if (!empty && ped != null) {
          switch (ped.getEstado()) {
          case PENDIENTE -> getStyleClass().add("pending");
          case EN_PREPARACION -> getStyleClass().add("preparacion");
          case SERVIDO -> getStyleClass().add("servido");
          case PAGADO_INDIVIDUAL -> getStyleClass().add("pagado_ind");
          default -> setStyle("");
          }
        }
      }
    });

    ordersTable.getSelectionModel().selectedItemProperty().addListener((obs, old, sel) -> {
      if (sel != null)
        showLineas(sel);
    });

    itemColumn.setCellValueFactory(c -> {
      String nombre = c.getValue().getMenuItem().getName();
      int cantidad = c.getValue().getCantidad();
      return new SimpleStringProperty(nombre + " x" + cantidad);
    });

    priceColumn.setCellValueFactory(c -> {
      BigDecimal precioUnitario = c.getValue().getPrecioUnitario();
      int cantidad = c.getValue().getCantidad();
      BigDecimal total = precioUnitario.multiply(BigDecimal.valueOf(cantidad));
      return new SimpleObjectProperty<>(total.doubleValue());
    });

    statusComboBox.setItems(FXCollections
        .observableArrayList(List.of(EstadoPedido.values()).stream().filter(e -> e != EstadoPedido.PAGADO).toList()));

  }

  /**
   * Carga los pedidos de una mesa y actualiza la interfaz.
   * 
   * @param mesaId ID de la mesa seleccionada
   */
  public void loadOrder(Long mesaId) {
    this.mesaId = mesaId;
    mesaLabel.setText("Mesa " + mesaId);
    recargarPedidosYTotal();
  }

  /**
   * Refresca la lista de pedidos y calcula el total de la mesa.
   */
  private void recargarPedidosYTotal() {
    List<Pedido> pedidos = pedidoRepo.findByMesaIdOrderByIdDesc(mesaId);
    ordersTable.setItems(FXCollections.observableArrayList(pedidos));
    if (pedidos.isEmpty()) {
      totalMesaLabel.setText("Total mesa: €0.00");
      return;
    }
    BigDecimal suma = pedidos.stream().map(Pedido::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2,
        RoundingMode.HALF_UP);
    totalMesaLabel.setText("Total mesa: €" + suma);
    ordersTable.getSelectionModel().selectFirst();
  }

  /**
   * Muestra las líneas de pedido del pedido seleccionado, incluyendo su
   * descripción personalizada.
   * 
   * @param pedido Pedido seleccionado
   */
  private void showLineas(Pedido pedido) {
    this.currentPedido = pedido;
    List<LineaPedido> lineas = lineaRepo.findByPedidoIdWithMenuItem(pedido.getId());
    orderTable.setItems(FXCollections.observableArrayList(lineas));
    statusComboBox.setValue(pedido.getEstado());

    if (pedido.getItems() != null) {
      try {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode itemsNode = mapper.readTree(pedido.getItems());

        StringBuilder descripcion = new StringBuilder();
        for (JsonNode item : itemsNode) {
          String nombre = item.get("name").asText();
          int cantidad = item.get("quantity").asInt();
          descripcion.append(nombre).append(" x").append(cantidad);

          if (item.has("personalizacion")) {
            descripcion.append(" (");
            for (JsonNode ingr : item.get("personalizacion")) {
              String ingrNombre = ingr.get("nombre").asText();
              int cant = ingr.get("cantidad").asInt();
              int extra = ingr.get("extra").asInt();
              if (cant == 0) {
                descripcion.append("sin ").append(ingrNombre).append(", ");
              } else if (extra > 0) {
                descripcion.append(ingrNombre).append(" +").append(extra).append(", ");
              } else {
                descripcion.append(ingrNombre).append(", ");
              }
            }
            if (descripcion.charAt(descripcion.length() - 2) == ',') {
              descripcion.setLength(descripcion.length() - 2);
            }
            descripcion.append(")");
          }

          descripcion.append("\n");
        }

        descripcionLabel.setText(descripcion.toString());

      } catch (Exception e) {
        descripcionLabel.setText("No se pudo leer la descripción del pedido.");
      }
    } else {
      descripcionLabel.setText("Este pedido no tiene personalización.");
    }
  }

  /**
   * Cambia el estado del pedido actual si se selecciona uno diferente. Si no
   * quedan pedidos pendientes, se restaura el estilo del botón de la mesa.
   */
  @FXML
  private void handleChangeState() {
    EstadoPedido nuevo = statusComboBox.getValue();
    EstadoPedido viejo = currentPedido.getEstado();
    if (nuevo == null || nuevo == viejo)
      return;

    pedidoRepo.actualizarEstado(currentPedido.getId(), nuevo);
    currentPedido.setEstado(nuevo);

    ordersTable.refresh();
    recargarPedidosYTotal();

    boolean hayPendientes = ordersTable.getItems().stream().anyMatch(p -> p.getEstado() == EstadoPedido.PENDIENTE);
    if (!hayPendientes) {
      Platform.runLater(() -> cincoCtrl.getMesasMap().get(mesaId).setStyle(cincoCtrl.getOriginalStyle(mesaId)));
    }
  }

  /**
   * Marca todos los pedidos de la mesa como pagados y cierra la ventana de
   * detalle.
   */
  @FXML
  private void handleCloseBill() {
    pedidoRepo.actualizarEstadoPorMesa(mesaId, EstadoPedido.PAGADO);
    ordersTable.getItems().forEach(p -> p.setEstado(EstadoPedido.PAGADO));
    ordersTable.refresh();
    recargarPedidosYTotal();

    Platform.runLater(() -> {
      boolean hayPendientes = ordersTable.getItems().stream().anyMatch(p -> p.getEstado() == EstadoPedido.PENDIENTE);
      if (!hayPendientes) {
        cincoCtrl.getMesasMap().get(mesaId).setStyle(cincoCtrl.getOriginalStyle(mesaId));
      }
    });

    Stage stage = (Stage) closeButton.getScene().getWindow();
    stage.close();
  }
}
