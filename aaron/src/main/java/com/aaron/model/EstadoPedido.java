// src/main/java/com/aaron/model/EstadoPedido.java
package com.aaron.model;
/**
 * Enum que representa los distintos estados por los que puede pasar un pedido en el sistema.
 * Se utiliza para controlar el flujo del pedido en la cocina y la gestión de cobros.
 */
public enum EstadoPedido {
    PENDIENTE,
    EN_PREPARACION,
    SERVIDO,
    PAGADO,
    PAGADO_INDIVIDUAL
}
