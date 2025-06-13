// src/main/java/com/aaron/repository/PedidoRepository.java
package com.aaron.repository;

import com.aaron.model.EstadoPedido;
import com.aaron.model.Pedido;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Repositorio para la entidad {@link Pedido}. Proporciona operaciones CRUD y
 * consultas personalizadas relacionadas con el estado y la mesa.
 */
public interface PedidoRepository extends JpaRepository<Pedido, Long> {

  /** Actualiza el estado de un pedido por su ID */
  @Modifying
  @Transactional
  @Query("UPDATE Pedido p SET p.estado = :estado WHERE p.id = :id")
  int actualizarEstado(@Param("id") Long id, @Param("estado") EstadoPedido estado);

  /** Actualiza el estado de todos los pedidos de una mesa */
  @Modifying
  @Transactional
  @Query("UPDATE Pedido p SET p.estado = :estado WHERE p.mesaId = :mesaId")
  int actualizarEstadoPorMesa(@Param("mesaId") Long mesaId, @Param("estado") EstadoPedido estado);

  /** Devuelve todos los pedidos de la mesa ordenados por ID descendente */
  List<Pedido> findByMesaIdOrderByIdDesc(Long mesaId);

}
