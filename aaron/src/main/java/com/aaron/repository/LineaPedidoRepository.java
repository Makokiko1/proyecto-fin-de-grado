// src/main/java/com/aaron/repository/LineaPedidoRepository.java
package com.aaron.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.aaron.model.LineaPedido;

/**
 * Repositorio de acceso a datos para las entidades {@link LineaPedido}.
 * Proporciona métodos personalizados para consultar las líneas de pedido
 * asociadas a un pedido.
 */
public interface LineaPedidoRepository extends JpaRepository<LineaPedido, Long> {

  /** Carga las líneas *y* su MenuItem en la misma consulta */
  @Query("""
      select l
        from LineaPedido l
        join fetch l.menuItem
       where l.pedido.id = :pedidoId
      """)
  List<LineaPedido> findByPedidoIdWithMenuItem(@Param("pedidoId") Long pedidoId);

  /** Si en algún otro sitio necesitas solo las líneas sin fetch */
  List<LineaPedido> findByPedidoId(Long pedidoId);
}
