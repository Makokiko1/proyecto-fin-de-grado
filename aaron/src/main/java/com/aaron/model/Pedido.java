package com.aaron.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
/**
 * Entidad que representa un pedido realizado por un usuario en una mesa.
 * Cada pedido puede contener múltiples líneas (productos) y tiene estado, total, fecha y usuario asociados.
 */
@Entity
@Table(name = "pedidos")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoPedido estado;

    @Column(name = "mesa_id", nullable = false)
    private Long mesaId;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha;

    /** Total del pedido */
    @Column(name = "total", nullable = false, precision = 10, scale = 2)
    private BigDecimal total;

    /** JSON con detalle de los items y personalizaciones */
    @Column(columnDefinition = "TEXT")
    private String items;

    @OneToMany(
        mappedBy = "pedido",
        cascade  = CascadeType.ALL,
        fetch    = FetchType.LAZY
    )
    private List<LineaPedido> lineas;

    // Getters y Setters

    public Long getId() {
        return id;
    }

    public EstadoPedido getEstado() {
        return estado;
    }

    public void setEstado(EstadoPedido estado) {
        this.estado = estado;
    }

    public Long getMesaId() {
        return mesaId;
    }

    public void setMesaId(Long mesaId) {
        this.mesaId = mesaId;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public LocalDateTime getFecha() {
        return fecha;
    }

    public void setFecha(LocalDateTime fecha) {
        this.fecha = fecha;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public void setTotal(BigDecimal total) {
        this.total = total;
    }

    public List<LineaPedido> getLineas() {
        return lineas;
    }

    public void setLineas(List<LineaPedido> lineas) {
        this.lineas = lineas;
    }

    public String getItems() {
        return items;
    }

    public void setItems(String items) {
        this.items = items;
    }

    @Override
    public String toString() {
        return "Pedido{" +
               "id=" + id +
               ", estado=" + estado +
               ", mesaId=" + mesaId +
               ", usuarioId=" + usuarioId +
               ", fecha=" + fecha +
               ", total=" + total +
               '}';
    }
}
