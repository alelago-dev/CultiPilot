/**
 * card.tsx
 *
 * Componente base para las tarjetas de la app. Antes de esto, "surface",
 * "metric-card", "metric-tile", "info-card", "task-row", etc. eran clases
 * CSS separadas que en la practica terminaron dibujando lo mismo (mismo
 * radio, mismo borde, misma sombra) pero por coincidencia: cada una se
 * fue empujando por su lado en pases de rediseno sucesivos, asi que un
 * cambio global (por ejemplo "las cards ahora tienen mas radio") obligaba
 * a repetir la misma lista de 15 nombres de clase en globals.css cada vez.
 *
 * `.card` es la definicion unica de esa base, sacada de los valores que
 * hoy efectivamente se ven en pantalla (verificado con getComputedStyle,
 * no copiado de la regla que uno cree que "deberia" ganar en la cascada).
 *
 * Por ahora solo existe la variante `default`. Las cards con acento
 * ("featured", como el card de Pendientes en Hoy) y las oscuras (como el
 * banner de espacio) tienen hoy tratamientos distintos entre si y al
 * menos una de ellas (metric-card.featured) hereda un color de texto
 * blanco que solo funciona por un parche puntual ya aplicado en otro
 * lado — sumarlas ya mismo a este componente exigiria decidir de nuevo
 * ese color, no solo copiarlo. Se deja para una pasada aparte en vez de
 * arrastrar ese bug al sistema nuevo.
 */

import type { ElementType, HTMLAttributes, ReactNode } from "react";

type CardVariant = "default" | "elevated" | "subtle";

type CardOwnProps = {
  as?: "div" | "section" | "article";
  variant?: CardVariant;
  children: ReactNode;
};

type CardProps = CardOwnProps & Omit<HTMLAttributes<HTMLElement>, keyof CardOwnProps>;

const variantClassName: Record<CardVariant, string> = {
  default: "card",
  elevated: "card card-elevated",
  subtle: "card card-subtle"
};

export function Card({ as = "div", variant = "default", className, children, ...rest }: CardProps) {
  const Tag = as as ElementType;
  const classes = [variantClassName[variant], className].filter(Boolean).join(" ");

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
