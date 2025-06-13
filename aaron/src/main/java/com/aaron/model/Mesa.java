package com.aaron.model;

import jakarta.persistence.*;

import java.util.List;
/**
 * Representa una mesa del restaurante.
 * Cada mesa tiene un identificador único y un código visible, por ejemplo, para asociarse con un QR.
 */
@Entity
@Table(name = "mesa")
public class Mesa {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String codigo;

    // ya no hay List<Pedido> pedidos

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }

    @Override
    public String toString() {
        return "Mesa{" + "id=" + id + ", codigo='" + codigo + '\'' + '}';
    }
}
