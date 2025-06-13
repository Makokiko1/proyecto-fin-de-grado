package com.aaron.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.aaron.model.Mesa;

/**
 * Repositorio para la entidad {@link Mesa}. Proporciona operaciones básicas de
 * CRUD y búsqueda personalizada por código.
 */
public interface MesaRepository extends JpaRepository<Mesa, Long> {
  Optional<Mesa> findByCodigo(String codigo);
}
