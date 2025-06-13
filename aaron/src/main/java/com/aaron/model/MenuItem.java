package com.aaron.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

/**
 * Representa un ítem del menú disponible en el restaurante. Contiene la
 * información básica de cada producto como su nombre, precio, disponibilidad y
 * categoría.
 */
@Entity
@Table(name = "menu_items")
public class MenuItem {

  @Id
  @Column(name = "id")
  private Long id;

  @Column(name = "category_id", nullable = false)
  private Long categoryId;

  @Column(nullable = false)
  private String name;

  @Column(columnDefinition = "text")
  private String description;

  @Column(nullable = false, precision = 10, scale = 2)
  private BigDecimal price;

  @Column(nullable = false)
  private Boolean available;

  @Column(columnDefinition = "TEXT")
  private String imageUrl;

  // ——— Getters & Setters ———

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getCategoryId() {
    return categoryId;
  }

  public void setCategoryId(Long categoryId) {
    this.categoryId = categoryId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public BigDecimal getPrice() {
    return price;
  }

  public void setPrice(BigDecimal price) {
    this.price = price;
  }

  public Boolean getAvailable() {
    return available;
  }

  public void setAvailable(Boolean available) {
    this.available = available;
  }

  public String getImageUrl() {
    return imageUrl;
  }

  public void setImageUrl(String imageUrl) {
    this.imageUrl = imageUrl;
  }
}
