export const ReorderPoints = (points) => {
  const centerX = points.reduce((acc, val) => acc + val[0], 0) / 4;
  const centerY = points.reduce((acc, val) => acc + val[1], 0) / 4;

  // Ensure points are sorted clockwise
  points = [...points]
    .sort((a, b) => {
      if(a[0] - centerX >= 0 && b[0] - centerX < 0) {
        return 1;
      } else if (a[0] - centerX < 0 && b[0] - centerX >= 0) {
        return -1;
      } else if(a[0] - centerX === 0 && b[0] - centerX === 0) {
        if (a[1] - centerY >= 0 || b[1] - centerY >= 0) {
          return a[1] > b[1] ? 1 : -1;
        } else {
          return b[1] > a[1] ? 1 : -1;
        }
      }

      // compute the cross product of vectors (center -> a) x (center -> b)
      const crossProduct = (a[0] - centerX) * (b[1] - centerY) - (b[0] - centerX) * (a[1] - centerY);
      if(crossProduct < 0) {
        return 1;
      } else if (crossProduct > 0) {
        return -1;
      }

      // points a and b are on the same line from the center
      // check which point is closer to the center
      const da = (a[0] - centerX) * (a[0] - centerX) + (a[1] - centerY) * (a[1] - centerY);
      const db = (b[0] - centerX) * (b[0] - centerX) + (b[1] - centerY) * (b[1] - centerY);

      return da > db ? 1 : -1;
    });

  // Resultant order starts in bottom left for rectangles, start in top left instead
  return [...points.slice(1), points[0]];
};

export const BoxToPoints = (box) => {
  let {x1, x2, y1, y2, x3, y3, x4, y4} = box;

  let points;
  if(!x3) {
    points = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  } else {
    points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
  }

  return ReorderPoints(points);
};

export const PointsToBox = (points, type) => {
  points = ReorderPoints(points);

  let isRectangle = type === "rectangle";

  if(!type) {
    isRectangle =
      points[0][0] === points[3][0] &&
      points[1][0] === points[2][0];
  }

  if(isRectangle) {
    return {
      x1: points[0][0],
      x2: points[2][0],
      y1: points[0][1],
      y2: points[2][1]
    };
  } else {
    return {
      x1: points[0][0], y1: points[0][1],
      x2: points[1][0], y2: points[1][1],
      x3: points[2][0], y3: points[2][1],
      x4: points[3][0], y4: points[3][1],
    };
  }
};

export const PointInPolygon = ([x, y], points) => {
  let inside = false;
  let p1 = points[0];
  let p2;
  for (let i=1; i <= points.length; i++) {
      p2 = points[i % points.length];

      if (y > Math.min(p1[1], p2[1])) {
          if (y <= Math.max(p1[1], p2[1])) {
              if (x <= Math.max(p1[0], p2[0])) {
                  const x_intersection = ((y - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]) + p1[0];

                  if (p1[0] === p2[0] || x <= x_intersection) {
                      inside = !inside;
                  }
              }
          }
      }

      p1 = p2;
  }

  return inside;
};

export const BoxToRectangle = box => {
  const points = BoxToPoints(box);

  let pos = {minY: 10000, minX: 10000, maxY: 0, maxX: 0};
  points
    .forEach(([x, y]) => {
      pos.minX = Math.min(x, pos.minX);
      pos.minY = Math.min(y, pos.minY);
      pos.maxX = Math.max(x, pos.maxX);
      pos.maxY = Math.max(y, pos.maxY);
    });

  return PointsToBox([
    [pos.minX, pos.minY],
    [pos.maxX, pos.minY],
    [pos.maxX, pos.maxY],
    [pos.minX, pos.maxY],
  ], "rectangle");
};

export const BoxToPolygon = box =>
  PointsToBox(BoxToPoints(box), "polygon");
