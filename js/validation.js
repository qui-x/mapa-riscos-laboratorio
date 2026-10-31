/**
 * Valida um objeto em relação aos demais objetos da área e retorna os problemas encontrados.
 */
function validateObject(o, objects, room) {
  const problems = [];
  if (o.hidden) return { valid: true, problems: [] };

  const corners = getObjectCorners(o);
  const isOutOfBounds = corners.some(p =>
    p.x < -0.01 || p.x > room.w + 0.01 || p.y < -0.01 || p.y > room.h + 0.01
  );
  if (isOutOfBounds) problems.push('Objeto fora dos limites da sala.');

  const isFurnitureOrEquip = SOLID_BLOCKERS.includes(o.type);
  const isExit = EXITS.includes(o.type);
  const isZone = CIRCULATION.includes(o.type);

  for (const other of objects) {
    if (other.id === o.id || other.hidden) continue;

    const overlaps = checkRectangleOverlap(o, other);
    if (!overlaps) continue;

    const isOtherFurnitureOrEquip = SOLID_BLOCKERS.includes(other.type);
    const isOtherExit = EXITS.includes(other.type);
    const isOtherZone = CIRCULATION.includes(other.type);

    if ((isFurnitureOrEquip && isOtherZone) || (isZone && isOtherFurnitureOrEquip)) {
      const intersection = getIntersectionArea(o, other);
      const zoneArea = isOtherZone ? other.w * other.h : (isZone ? o.w * o.h : 0);
      const ratio = zoneArea > 0 ? intersection / zoneArea : 0;
      if (ratio > 0.4) {
        problems.push(`Sobreposição significativa com área de circulação (${Math.round(ratio * 100)}%).`);
      }
    }

    if (isFurnitureOrEquip && isOtherFurnitureOrEquip) {
      const isSupportedPair =
        (TIPOS_BASE.includes(o.type) && TIPOS_APOIADOS.includes(other.type)) ||
        (TIPOS_APOIADOS.includes(o.type) && TIPOS_BASE.includes(other.type));

      if (isSupportedPair) {
        if (!canOverlapAsSupportedPair(o, other)) {
          problems.push('O item precisa estar totalmente sobre a superfície de apoio.');
        }
      } else {
        problems.push(`Sobreposição indevida com outro elemento (${TYPES[other.type]?.[0] || other.type}).`);
      }
    }

    if (isFurnitureOrEquip && isOtherExit) {
      const blockRatio = calculateDoorBlockRatio(other, o);
      if (blockRatio > 0.8) {
        problems.push(`Bloqueia mais de 80% da saída (${(blockRatio * 100).toFixed(0)}%) — Violação da NR-23.`);
      } else if (blockRatio > 0) {
        problems.push(`Sobrepõe a rota de fuga/saída (${(blockRatio * 100).toFixed(0)}%).`);
      }
    }

    if (isExit && isOtherFurnitureOrEquip) {
      const blockRatio = calculateDoorBlockRatio(o, other);
      if (blockRatio > 0.8) {
        problems.push(`Saída bloqueada em mais de 80% por ${TYPES[other.type]?.[0] || other.type} — Violação da NR-23.`);
      } else if (blockRatio > 0) {
        problems.push(`Saída desobstruída parcialmente por ${TYPES[other.type]?.[0] || other.type}.`);
      }
    }
  }

  if (isExit && isExitClearanceBlocked(o, objects)) {
    problems.push('Objeto na área de aproximação da saída — rota de fuga obstruída (NR-23).');
  }

  return { valid: problems.length === 0, problems };
}
